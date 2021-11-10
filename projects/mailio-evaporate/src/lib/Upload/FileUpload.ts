import { S3Client, CreateMultipartUploadCommand, CreateMultipartUploadCommandInput, UploadPartCommand, UploadPartCommandInput, ListMultipartUploadsCommand, ListMultipartUploadsCommandInput, CreateMultipartUploadCommandOutput, CompleteMultipartUploadCommandInput, CompleteMultipartUploadCommand, CompleteMultipartUploadCommandOutput, MultipartUpload, AbortMultipartUploadCommandInput, AbortMultipartUploadCommand, AbortMultipartUploadCommandOutput, UploadPartCommandOutput, CompletedPart } from '@aws-sdk/client-s3';
import { Observable, Subject } from 'rxjs';
import * as SparkMD5 from 'spark-md5';
import { InternalEvent } from '../models/InternalEvent';
import { MailioEvaporateConfig } from "../models/MailioEvaporateConfig";
import { UploadStatus } from "../models/UploadConstants";
import { UploadStats } from "../models/UploadStats";
import { base64ToHex, readableFileSize } from "../Utils/Utils";

export class FileUpload  {

  // s3 client
  private s3client:S3Client;

  // observable monitoring for file upload
  public uploadStats$:Observable<UploadStats>;

  // upload stats
  private uploadStats:Subject<UploadStats>;
  private reason?: any; // can be Error if upload failed or reason for the status
  bytesUploadedUntilNow:number = 0;
  totalFileSizeBytes: number = 0;

  // internal events
  private events:Subject<InternalEvent>;

  // list of completed parts uploads
  private partsOnS3:CompletedPart[];
  private partNumber:number = 0;

  // aws config and file references
  public fileKey:string;
  public uploadId:string | undefined;
  config: MailioEvaporateConfig;
  public status: UploadStatus;
  public file:File;
  private sparkMd5;

  // Progress and Stats
  private progressInterval:any;
  private startTime:Date | undefined;

  constructor(file: File, awsclient:S3Client, config: MailioEvaporateConfig) {
    // init
    this.config = config;
    this.fileKey = decodeURIComponent(`${config.bucket}/${file.name}`);
    this.file = file;
    this.totalFileSizeBytes = file.size;
    this.partsOnS3 = [];
    this.startTime = new Date();
    this.status = UploadStatus.PENDING;
    this.events = new Subject();
    this.uploadStats = new Subject();
    this.uploadStats$ = this.uploadStats.asObservable();

    this.sparkMd5 = new SparkMD5.ArrayBuffer();

    this.s3client = awsclient;

    // handling internal FileUpload events
    this.events.subscribe((event:InternalEvent) => {
      // console.log('internal event: ', event);
      this.reason = event.payload;
      switch (event.type) {
        case UploadStatus.START: // start the upload
          this.uploadParts();
          break;
        case UploadStatus.ERROR:
          this.status = UploadStatus.ERROR;
          this.done();
          break;
        case UploadStatus.EVAPORATING:
          this.status = UploadStatus.EVAPORATING;
          if (this.uploadId && this.file) {
            this._progressStats();
          }
          break;
        case UploadStatus.PENDING:
          this.status = UploadStatus.PENDING;
          break;
        case UploadStatus.ABORTED:
          this.status = UploadStatus.ABORTED;
          this.done();
          break;
        case UploadStatus.COMPLETE:
          this.status = UploadStatus.COMPLETE;
          this.completeUpload();
          break;
        case UploadStatus.DONE:
          this.stopMonitor();
          this.done();
          break;
        default:
        break;
      }
    });
  }


  /**
   * Upload stats for this file
   *
   * @returns UploadStats
   */
  _progressStats(): UploadStats {
    // Adapted from https://github.com/fkjaekel
    // https://github.com/TTLabs/EvaporateJS/issues/13
    if (this.bytesUploadedUntilNow === 0) {
      const stats:UploadStats =  {
        fileSize: this.file.size,
        readableSpeed: "0.00 KB/s",
        remainingSize: 0,
        secondsLeft: 0,
        speed: 0,
        progress: 0,
        totalUploaded: 0,
        error: (this.reason instanceof Error) ? this.reason : undefined,
        message: (this.reason instanceof Error) ? undefined : this.reason,
        status: this.status,
        uploadId: this.uploadId,
      };
      this.uploadStats.next(stats);
      return stats;
    }

    // console.log('total uploaded: ', this.bytesUploadedUntilNow);
    let delta = (new Date().getTime() - (this.startTime?.getTime() || 0)) / 1000;
    let avgSpeed = this.bytesUploadedUntilNow / delta;
    let remainingSize = this.totalFileSizeBytes - this.bytesUploadedUntilNow;

    const stats:UploadStats = {
      speed: avgSpeed,
      readableSpeed: readableFileSize(avgSpeed),
      totalUploaded: this.bytesUploadedUntilNow,
      remainingSize: remainingSize,
      secondsLeft: -1,
      fileSize: this.totalFileSizeBytes,
      progress: this.bytesUploadedUntilNow / this.totalFileSizeBytes,
      status: this.status,
      uploadId: this.uploadId,
      message: (this.reason instanceof Error) ? undefined : this.reason,
    };

    if (avgSpeed > 0) {
      stats.secondsLeft = Math.round(remainingSize / avgSpeed);
    }
    this.uploadStats.next(stats);
    return stats;
  }

  /**
   * Start file upload
   * @returns
   */
  async start(): Promise<string> {
    this.status = UploadStatus.EVAPORATING;
    this.startMonitor();

    const params:CreateMultipartUploadCommandInput = {
      Bucket: this.config.bucket,
      Key: this.file.name,
      ContentType: this.file.type,
    }
    const multipartUpload = new CreateMultipartUploadCommand(params);
    try {
      const comm:CreateMultipartUploadCommandOutput = await this.s3client.send(multipartUpload);
      this.uploadId = comm.UploadId;
      if (!comm.UploadId) {
        this.events.next({ type: UploadStatus.ERROR, payload: "No upload id" });
        throw new Error('No upload id');
      } else {
        this.events.next({ type: UploadStatus.START, payload: "started" });
        return comm.UploadId;
      }
    } catch (err:any) {
      console.error(err);
      this.events.next({ type: UploadStatus.ERROR, payload: err });
      throw err;
    }
  }

  async uploadPart(filePart:ArrayBuffer): Promise<void> {

    if (this.uploadId != null) {

      let md5Content = undefined;
      const md5 = this.sparkMd5!.append(filePart);
      const md5Raw = md5.end(true);
      md5Content = btoa(md5Raw);

      this.partNumber++;

      const currentPartNumber = this.partNumber;

      const chunkComplete:CompletedPart = {
        ETag: '\"' + base64ToHex(md5Content) + '\"',
        PartNumber: currentPartNumber,
      };
      this.partsOnS3.push(chunkComplete);

      const uploadPartInput:UploadPartCommandInput = {
        Key: this.file.name,
        Bucket: this.config.bucket,
        UploadId: this.uploadId,
        PartNumber: currentPartNumber,
        Body: new Blob([new Uint8Array(filePart, 0, filePart.byteLength)]),
        ContentLength: filePart.byteLength,
        ContentMD5: md5Content,
      };

      const uploadPart = new UploadPartCommand(uploadPartInput);
      this.s3client.send(uploadPart).then((response:UploadPartCommandOutput) => {

        if (response.$metadata.httpStatusCode === 200) {
          // this.partsOnS3.push({ETag: etag, PartNumber: currentPartNumber});
          this.bytesUploadedUntilNow += filePart.byteLength;

          if (this.totalFileSizeBytes - this.bytesUploadedUntilNow > 0) {
            this.events.next({ type: UploadStatus.EVAPORATING, payload: response });
          } else {
            this.events.next({ type: UploadStatus.COMPLETE, payload: response });
          }
        } else {
          console.error('failed upload of a chunk', response);
          this.events.next({ type: UploadStatus.ERROR, payload: response });
        }
      }).catch((err:any) => {
        console.error(err);
        this.events.next({ type: UploadStatus.ERROR, payload: err });
      });
    }
  }

  /**
   * Read file in chunks from disk and upload to S3
   *
   * @param file File (input file)
   */
  async uploadParts() {

    let i:number = 0;
    const chunk = this.config.partSize || (5 * 1024 * 1024);
    while (i < this.file.size) {
      const start = i;
      const end = i + chunk;
      const part = this.file.slice(start, end);
      i += chunk;
      const filePart:ArrayBuffer = await part.arrayBuffer();
      this.uploadPart(filePart);
    }
  }

  completeUpload() {
    if (this.partsOnS3) {
      this.partsOnS3 = this.partsOnS3.sort((a, b) => ((a.PartNumber ? a.PartNumber : 0) - (b.PartNumber ? b.PartNumber : 0)));
      console.log('ordered parts: ', this.partsOnS3);
      const completeMultipartUploadInput:CompleteMultipartUploadCommandInput = {
        Bucket: this.config.bucket,
        Key: this.file.name,
        UploadId: this.uploadId!,
        MultipartUpload: {
          Parts: this.partsOnS3,
        },
      };
      const completeMultipartUpload = new CompleteMultipartUploadCommand(completeMultipartUploadInput);
      this.s3client.send(completeMultipartUpload).then((response:CompleteMultipartUploadCommandOutput) => {
        this.events.next({ type: UploadStatus.DONE, payload: response });
      }).catch((err:any) => {
        this.events.next({ type: UploadStatus.ERROR, payload: err });
        console.error(err);
      });
    }
  }

  /**
   * Start the progress monitor
   */
  startMonitor() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
    this.startTime = new Date();

    // this.progressInterval = setInterval(() => {
    //   this.onProgress();
    // }, this.config.progressIntervalMS || 10000);
  }

  stopMonitor() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
  }

  /**
   *
   * @param upload
   * @returns
   */
  __abort(upload: MultipartUpload): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const abortInput:AbortMultipartUploadCommandInput = {
        Bucket: this.config.bucket,
        Key: this.file.name,
        UploadId: upload.UploadId,
      };
      const abortCommand = new AbortMultipartUploadCommand(abortInput);
      this.s3client.send(abortCommand).then((response:AbortMultipartUploadCommandOutput) => {
        resolve(true);
      }).catch((err:any) => {
        console.error(err);
        reject(err);
      });
    });
  }

  /**
   * Aborting file uplod
   * @returns Promise<boolean> // true if aborted, rejected otherwise with error
   */
  abort(): Promise<boolean> {
    if (this.uploadId && this.file) {
      const upload: MultipartUpload = {
        Key: this.file.name,
        UploadId: this.uploadId!,
      };
      return this.__abort(upload);
    }
    return Promise.reject(new Error('failed to abort upload. File missing or upload never initiated'));
  }

  done() {
    this._progressStats();
    this.s3client.destroy();
    this.events.unsubscribe();
    this.partsOnS3 = [];
    this.partNumber = 0;
    this.uploadId = undefined;
    this.totalFileSizeBytes = 0;
    this.status = UploadStatus.DONE;
    this.bytesUploadedUntilNow = 0;
    this.uploadStats.unsubscribe();
    this.stopMonitor();
  }

}
