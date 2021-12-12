import { Inject, Injectable } from '@angular/core';
import { Sha256 } from '@aws-crypto/sha256-js';
import { ListMultipartUploadsCommand, ListMultipartUploadsCommandInput, MultipartUpload, S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { MAILIO_EVAPORATE_CONFIG } from './config';
import { EvaporateProgress } from './Types/EvaporateProgress';
import { awsSignatureV4AuthMiddleware } from './awsAuthPlugin/AWSSignatureV4AuthMiddleware';
import { FileUpload } from './Upload/FileUpload';
import { s3EncodedObjectName } from './Utils/Utils';
import { MailioAWSSignatureV4 } from './awsAuthPlugin/MailioAwsSignatureV4';
import { MailioSignatureInit } from './awsAuthPlugin/mailioSignatureInit';
import { MailioEvaporateConfig, validateConfig } from './Types/MailioEvaporateConfig';
import { UploadStats } from './Types/UploadStats';

@Injectable({
  providedIn: 'root'
})
export class MailioEvaporateService {

  // main evaporate structures
  config: MailioEvaporateConfig;
  private queue:FileUpload[];
  private stats: UploadStats[];
  s3client: S3Client;
  awsV4Signer: MailioAWSSignatureV4;

  // progress
  private uploadProgress$:Observable<EvaporateProgress>;
  private uploadProgress:Subject<EvaporateProgress>;

  // publicly available observables following observable data source pattern
  private _uploads:BehaviorSubject<UploadStats[]> = new BehaviorSubject<UploadStats[]>([]);

  constructor(@Inject(MAILIO_EVAPORATE_CONFIG) config: MailioEvaporateConfig) {
    console.log('service constructor called: ', config);
    validateConfig(config);
    this.config = config;
    // init other values
    this.queue = [];
    this.stats = [];

    /**
     * Upload progress
     */
    this.uploadProgress = new Subject();
    this.uploadProgress$ = this.uploadProgress.asObservable();

    // init aws s3 client
    const s3Config:S3ClientConfig = {
      credentials: {
        accessKeyId: config.awsKey,
        secretAccessKey: 'empty', // the string doesn't matter but has to be here due to S3Client restrictions
      },
      region: config.awsRegion,
    };
    const awsclient = new S3Client(s3Config);
    this.s3client = awsclient;

    const signerInit: MailioSignatureInit = {
      service: config.awsService,
      region: config.awsRegion,
      sha256: Sha256,
      awsCredentials: {
        accessKeyId: config.awsKey,
      },
      authServerUrl: config.authServerUrl,
    };

    // init authentication signing plugin middleware
    this.awsV4Signer = new MailioAWSSignatureV4(signerInit);
    this.s3client.middlewareStack.add(awsSignatureV4AuthMiddleware(this.awsV4Signer), { step: 'finalizeRequest', priority: 'high', name: 'mailioAuthPlugin' });


    // subscribe to FileUpload Evaporate events and update stats array for the files
    this.uploadProgress$.subscribe((progress: EvaporateProgress) => {
      // find a file in the queue by uploadId if exists
      // it should exist, otherwise this.add method has failed ( -> CreateMultipartUploadCommand)
      let foundFileUploadIndex = -1;
      if (progress.uploadId) {
        foundFileUploadIndex = this.queue.findIndex((fu: FileUpload) => (fu.uploadId === progress.uploadId));
      }
      if (foundFileUploadIndex > -1) {
        // if stats found update, otherwise add to the stats array
        const statIndex:number = this.stats.findIndex((stat:UploadStats) => (stat.uploadId! === progress.uploadId!));

         if (statIndex > -1) {
           // found it
           this.stats[statIndex] = progress.stats;
         } else {
           this.stats.push(progress.stats);
         }
        this._uploads.next(this.stats);
      }
    });
  }

  /**
   * Returns observable upload list of files that are in the upload process (start to finish)
   */
  get uploads():Observable<UploadStats[]> {
    return this._uploads.asObservable();
  }

  /**
   * This action lists in-progress multipart uploads.
   * An in-progress multipart upload is a multipart upload that has been initiated,
   * but has not yet been completed or aborted.
   *
   * This action returns at most 1,000 multipart uploads in the response
   *
   * You can further limit the number of uploads in a response by specifying the max-uploads parameter in the response.
   * If additional multipart uploads satisfy the list criteria, the response will contain an IsTruncated element with
   * the value true. To list the additional multipart uploads, use the key-marker and upload-id-marker
   * request parameters.
   *
   * @returns Promise<MultipartUpload[]> (resolve or reject)
   */
  listDanglingUploads(): Promise<MultipartUpload[]> {
    return new Promise((resolve, reject) => {
    const input:ListMultipartUploadsCommandInput = {
      Bucket: this.config.bucket,
    };
    const listCommand = new ListMultipartUploadsCommand(input);
    try {
      this.s3client.send(listCommand).then(response => {
        const uploads = response.Uploads;
        if (uploads) {
          resolve(uploads);
        } else {
          resolve([]);
        }
      }).catch(err => {
        console.error(err);
        reject(err);
      });
    } catch (err) {
      console.error(err);
      reject(err);
    }
    });
  }

  /**
   * Add file to the upload queue.
   *
   * @param file File to upload
   * @param path Optional subpath parameter for files requiring folder hierarchy (e.g. /bucket/path/filename.png)
   * @returns Promise (resolve or reject) with uploadId
   */
  async add(file:File, path?:string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof file === 'undefined' || typeof file === 'undefined') {
        return reject('Missing file');
      }
      if (file.name === '') {
        return reject('Missing file name');
      };
      const fileName:string = s3EncodedObjectName(file.name);
      const fileToUpload:File = new File([file], fileName, {type: file.type});

      // strip possible starting or ending path /
      if (path) {
        if (path.startsWith('/')) {
          path = path.substring(1);
        }
        if (path.endsWith('/')) {
          path = path.slice(0, -1);
        }
        if (path.includes('\\')) {
          return reject('illegal character in path');
        }
      }

      const fileUpload = new FileUpload(this.s3client, this.config, fileToUpload, path);
      fileUpload.start().then((uploadId:string) => {
        fileUpload.uploadStats$.subscribe((stats) => {
            this.uploadProgress.next({stats, filename: fileName, uploadId: uploadId});
        });
        this.queue.push(fileUpload);
        resolve(uploadId);
      }).catch(err => {
        console.error(err);
        reject(err);
      });
    });
  }

  /**
   * Pause a specific file upload by uploadId
   * @param uploadId string
   */
  async pause(uploadId:string): Promise<void> {
    return new Promise((resolve, reject) => {
      const fileUpload = this.queue.find(fileUpload => fileUpload.uploadId === uploadId);
      if (fileUpload) {
        fileUpload.pauseUpload();
        resolve();
      } else {
        reject('File with uploadId ' + uploadId + ' not found');
      }
    });
  }

  /**
   * Resume a specific file upload by uploadId
   * @param uploadId
   * @returns
   */
  async resume(uploadId:string): Promise<void> {
    console.log('resume called');
    return new Promise((resolve, reject) => {
      const fileUpload = this.queue.find(fileUpload => fileUpload.uploadId === uploadId);
      if (fileUpload) {
        fileUpload.resumeUpload();
        resolve();
      } else {
        reject('File with uploadId ' + uploadId + ' not found');
      }
    });
  }
}
