import {
  S3Client,
  CreateMultipartUploadCommand,
  CreateMultipartUploadCommandInput,
  UploadPartCommand,
  UploadPartCommandInput,
  CreateMultipartUploadCommandOutput,
  CompleteMultipartUploadCommandInput,
  CompleteMultipartUploadCommand,
  CompleteMultipartUploadCommandOutput,
  MultipartUpload,
  AbortMultipartUploadCommandInput,
  AbortMultipartUploadCommand,
  AbortMultipartUploadCommandOutput,
  UploadPartCommandOutput,
  CompletedPart,
} from '@aws-sdk/client-s3';
import { from, merge, Observable, of, Subject } from 'rxjs';
import * as SparkMD5 from 'spark-md5';
import { FileChunk } from '../Types/FileChunk';
import { InternalEvent } from '../Types/InternalEvent';
import { base64ToHex, readableFileSize } from '../Utils/Utils';
import {
  bufferToggle,
  catchError,
  distinctUntilChanged,
  filter,
  mergeMap,
  retry,
  share,
  windowToggle,
} from 'rxjs/operators';
import { MailioEvaporateConfig, UploadStats, UploadStatus } from '../mailio-evaporate-types';

export class FileUpload {
  // s3 client
  private s3client: S3Client;

  // observable monitoring for file upload
  public uploadStats$: Observable<UploadStats>;

  // upload stats
  private uploadStats: Subject<UploadStats>;
  private reason?: any; // can be Error if upload failed or reason for the status
  bytesUploadedUntilNow:number = 0;
  totalFileSizeBytes: number = 0;

  // internal events
  private events: Subject<InternalEvent>;

  // list of completed parts uploads
  private partsInProgress: FileChunk[] = [];
  private completedChunks: CompletedPart[];
  private partNumber: number = 0;
  private totalNumberOfChunks: number = 0;

  // File upload Subjects and Observables
  // pausing and resuming a file upload queue (buffered pausable observable)
  // read more at: https://igor.technology/rxjs-pause-resume/
  private fileChunkQueue: Subject<FileChunk>;
  private pause: Subject<boolean> = new Subject();
  private pause$: Observable<boolean> = this.pause.pipe(
    distinctUntilChanged(),
    share()
  );
  private pauseOn$: Observable<boolean> = this.pause$.pipe(filter((v) => !v));
  private pauseOff$: Observable<boolean> = this.pause$.pipe(filter((v) => !!v));

  // aws config and file references
  public fileKey: string;
  public uploadId: string | undefined;
  config: MailioEvaporateConfig;
  public status: UploadStatus;
  public file: File;
  private sparkMd5;

  // Marking the startTime of the upload
  private startTime: Date | undefined;

  constructor(awsclient: S3Client, config: MailioEvaporateConfig, file: File, fileSubPath?: string) {
    // init
    this.config = config;
    if (fileSubPath) {
      this.fileKey = decodeURIComponent(`${fileSubPath}/${file.name}`);
    } else {
      this.fileKey = decodeURIComponent(`${file.name}`);
    }

    this.file = file;
    this.totalFileSizeBytes = file.size;
    this.completedChunks = [];
    this.totalNumberOfChunks = 0;
    this.fileChunkQueue = new Subject<FileChunk>();
    this.startTime = new Date();
    this.status = UploadStatus.PENDING;
    this.events = new Subject();
    this.uploadStats = new Subject();
    this.uploadStats$ = this.uploadStats.asObservable();

    this.sparkMd5 = new SparkMD5.ArrayBuffer();

    this.s3client = awsclient;

    // handling internal FileUpload events
    this.events.subscribe((event: InternalEvent) => {
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
          this.done();
          break;
        default:
          break;
      }
    });

    const uploadPipe: Observable<FileChunk> = this.fileChunkQueue.pipe(
      mergeMap((fileChunk: FileChunk) => {
        return from(this.uploadPart(fileChunk));
      }, this.config.maxConcurrentParts),
      retry(3), // retry 3 times on error
    );

    const uploadPipeObserver: Observable<FileChunk> = merge(
      uploadPipe.pipe(
        bufferToggle(this.pauseOff$, () => this.pauseOn$),
        mergeMap((x) => x)
      ),
      uploadPipe.pipe(
        windowToggle(this.pauseOn$, () => this.pauseOff$),
        mergeMap((x) => x)
      )
    ).pipe(
      catchError((err) => {
        console.error(err);
        return of(err);
      })
    );

    // subscribe to upload pipe
    // removes the chunks from upload queue and places completedPart in completedChunks
    // when partsInProgress is empty, the upload is complete
    uploadPipeObserver.subscribe((chunk: FileChunk) => {
      const foundindex = this.partsInProgress.findIndex(
        (queued: FileChunk) => queued.partNumber === chunk.partNumber
      );
      if (foundindex >= 0) {
        // chunk found in progress queue
        this.completedChunks.push(chunk.completedPart);
        this.bytesUploadedUntilNow += chunk.chunk.byteLength;
        this.partsInProgress.splice(foundindex, 1);
        this.events.next({
          type: UploadStatus.EVAPORATING,
          payload: 'evaporating'
        })
      }
      if (this.partsInProgress.length === 0) {
        this.events.next({
          type: UploadStatus.COMPLETE,
          payload: 'upload complete',
        });
      }
    });

    // init pauser
    this.pause.next(true);
    this.pause.next(false);
  }

  /**
   * Upload stats for this file
   *
   * @returns UploadStats
   */
  _progressStats(): UploadStats {
    // Adapted from https://github.com/fkjaekel
    // https://github.com/TTLabs/EvaporateJS/issues/13

    if (
      this.bytesUploadedUntilNow === 0
    ) {
      const stats: UploadStats = {
        fileSize: this.file.size,
        fileName: this.file.name,
        fullFilePath:`${this.config.bucket}/${this.fileKey}`,
        fileType: this.file.type,
        readableSpeed: '0.00 KB/s',
        remainingSize: 0,
        secondsLeft: 0,
        speed: 0,
        progress: 0,
        totalUploaded: 0,
        error: this.reason instanceof Error ? this.reason : undefined,
        status: this.status,
        uploadId: this.uploadId,
      };
      this.uploadStats.next(stats);
      return stats;
    }

    let delta =
      (new Date().getTime() - (this.startTime?.getTime() || 0)) / 1000;
    let avgSpeed = this.bytesUploadedUntilNow / delta;
    let remainingSize = this.totalFileSizeBytes - this.bytesUploadedUntilNow;

    const stats: UploadStats = {
      speed: avgSpeed,
      fileName: this.file.name,
      fullFilePath:`${this.config.bucket}/${this.fileKey}`,
      fileType: this.file.type,
      readableSpeed: readableFileSize(avgSpeed),
      totalUploaded: this.bytesUploadedUntilNow,
      remainingSize: remainingSize,
      secondsLeft: -1,
      fileSize: this.totalFileSizeBytes,
      progress: this.bytesUploadedUntilNow / this.totalFileSizeBytes,
      status: this.status,
      uploadId: this.uploadId,
      error: this.reason instanceof Error ? this.reason : undefined,
    };

    if (avgSpeed > 0) {
      const sl = Math.round(remainingSize / avgSpeed);
      stats.secondsLeft = sl > 0 ? sl : 0;
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
    this.setStartTime();

    const params: CreateMultipartUploadCommandInput = {
      Bucket: this.config.bucket,
      Key: this.fileKey,
      ContentType: this.file.type,
    };
    const multipartUpload = new CreateMultipartUploadCommand(params);
    try {
      const comm: CreateMultipartUploadCommandOutput = await this.s3client.send(
        multipartUpload
      );
      this.uploadId = comm.UploadId;
      if (!comm.UploadId) {
        this.events.next({ type: UploadStatus.ERROR, payload: 'No upload id' });
        throw new Error('No upload id');
      } else {
        this.events.next({ type: UploadStatus.START, payload: 'started' });
        return comm.UploadId;
      }
    } catch (err: any) {
      console.error(err);
      this.events.next({ type: UploadStatus.ERROR, payload: err });
      throw err;
    }
  }

  async uploadPart(fileChunk: FileChunk): Promise<FileChunk> {
    return new Promise<FileChunk>((resolve, reject) => {
      if (this.uploadId != null) {
        const uploadPartInput: UploadPartCommandInput = {
          Key: this.fileKey,
          Bucket: this.config.bucket,
          UploadId: this.uploadId,
          PartNumber: fileChunk.partNumber,
          Body: new Blob([
            new Uint8Array(fileChunk.chunk, 0, fileChunk.chunk.byteLength),
          ]),
          ContentLength: fileChunk.chunk.byteLength,
          ContentMD5: fileChunk.ContentMD5,
        };

        const uploadPart = new UploadPartCommand(uploadPartInput);

        this.s3client
          .send(uploadPart)
          .then((response: UploadPartCommandOutput) => {
            if (response.$metadata.httpStatusCode === 200) {
              fileChunk.status = UploadStatus.COMPLETE;
              resolve(fileChunk);
            } else {
              console.error('failed upload of a chunk', response);
              reject(response);
            }
          })
          .catch((err: any) => {
            console.error(err);
            reject(err);
          });
      }
    });
  }

  /**
   * Read file in chunks from disk and upload to S3
   *
   * @param file File (input file)
   */
  async uploadParts() {
    let i: number = 0;
    const chunk = this.config.partSize || 5 * 1024 * 1024;
    this.totalNumberOfChunks = Math.ceil(
      this.file.size / (this.config.partSize || 5 * 1024 * 1024)
    );
    let isLastChunk:boolean = false;
    let isFirstChunk:boolean = true;
    while (i < this.file.size) {
      const start = i;
      const end = i + chunk;
      if (end >= this.file.size) {
        isLastChunk = true;
      }
      const part = this.file.slice(start, end);
      i += chunk;
      const filePart: ArrayBuffer = await part.arrayBuffer();

      // calculate md5, increase part number and prepare ETag, PartNumber for CompletedPart
      let md5Content = undefined;
      const md5 = this.sparkMd5!.append(filePart);
      const md5Raw = md5.end(true);
      md5Content = btoa(md5Raw);

      this.partNumber++;

      const currentPartNumber = this.partNumber;

      const chunkComplete: CompletedPart = {
        ETag: '"' + base64ToHex(md5Content) + '"',
        PartNumber: currentPartNumber,
      };
      const fileChunk: FileChunk = {
        chunk: new ArrayBuffer(0),
        partNumber: currentPartNumber,
        completedPart: chunkComplete,
        status: UploadStatus.PENDING,
        ContentMD5: md5Content,
      };

      // if part transformation function is defined, transform the part
      // if (this.config.transformPart) {
          // const transformedPart = await this.config.transformPart(filePart, isFirstChunk, isLastChunk);
          // fileChunk.chunk = transformedPart;
      // } else {
        fileChunk.chunk = filePart;
      // }


      this.partsInProgress.push(fileChunk);
      this.fileChunkQueue.next(fileChunk);

      isFirstChunk = false;
    }
  }

  completeUpload() {
    if (this.completedChunks.length > 0 && this.uploadId) {
      this.completedChunks = this.completedChunks.sort(
        (a, b) =>
          (a.PartNumber ? a.PartNumber : 0) - (b.PartNumber ? b.PartNumber : 0)
      );
      const completeMultipartUploadInput: CompleteMultipartUploadCommandInput =
        {
          Bucket: this.config.bucket,
          Key: this.fileKey,
          UploadId: this.uploadId!,
          MultipartUpload: {
            Parts: this.completedChunks,
          },
        };
      const completeMultipartUpload = new CompleteMultipartUploadCommand(
        completeMultipartUploadInput
      );
      this.s3client
        .send(completeMultipartUpload)
        .then((response: CompleteMultipartUploadCommandOutput) => {
          this.events.next({ type: UploadStatus.DONE, payload: response });
        })
        .catch((err: any) => {
          this.events.next({ type: UploadStatus.ERROR, payload: err });
          console.error(err);
        });
    }
  }

  /**
   * Set start time
   */
  setStartTime() {
    this.startTime = new Date();
  }

  /**
   *
   * @param upload
   * @returns
   */
  __abort(upload: MultipartUpload): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const abortInput: AbortMultipartUploadCommandInput = {
        Bucket: this.config.bucket,
        Key: this.fileKey,
        UploadId: upload.UploadId,
      };
      const abortCommand = new AbortMultipartUploadCommand(abortInput);
      this.s3client
        .send(abortCommand)
        .then((response: AbortMultipartUploadCommandOutput) => {
          resolve(true);
        })
        .catch((err: any) => {
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
        Key: this.fileKey,
        UploadId: this.uploadId!,
      };
      return this.__abort(upload);
    }
    return Promise.reject(
      new Error(
        'failed to abort upload. File missing or upload never initiated'
      )
    );
  }

  pauseUpload() {
    this.pause.next(true);
  }

  resumeUpload() {
    this.pause.next(false);
  }

  done() {
    this._progressStats();
    this.s3client.destroy();
    if (this.events) {
      this.events.unsubscribe();
    }
    if (this.uploadStats) {
      this.uploadStats.unsubscribe();
    }
    if (this.pause) {
      this.pause.unsubscribe();
    }
    this.completedChunks = [];
    this.partNumber = 0;
    this.uploadId = undefined;
    this.totalFileSizeBytes = 0;
    this.status = UploadStatus.DONE;
  }
}
