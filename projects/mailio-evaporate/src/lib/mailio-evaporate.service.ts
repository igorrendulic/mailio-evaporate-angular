import { Inject, Injectable } from '@angular/core';
import { ListMultipartUploadsCommand, ListMultipartUploadsCommandInput, MultipartUpload, S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { Observable, Subject } from 'rxjs';
import { MAILIO_EVAPORATE_CONFIG } from './config';
import { EvaporateProgress } from './models/EvaporateProgress';
import { MailioEvaporateConfig, validateConfig } from './models/MailioEvaporateConfig';
import { FileUpload } from './Upload/FileUpload';
import { s3EncodedObjectName } from './Utils/Utils';

@Injectable({
  providedIn: 'root'
})
export class MailioEvaporateService {

  // main evaporate structures
  config: MailioEvaporateConfig;
  queue:File[];
  s3client: S3Client;

  // progress
  public uploadProgress$:Observable<EvaporateProgress>;
  private uploadProgress:Subject<EvaporateProgress>;

  constructor(@Inject(MAILIO_EVAPORATE_CONFIG) config: MailioEvaporateConfig) {
    validateConfig(config);
    this.config = config;
    // init other values
    this.queue = [];

    /**
     * Upload progress
     */
    this.uploadProgress = new Subject();
    this.uploadProgress$ = this.uploadProgress.asObservable();

    // init aws s3 client
    const s3Config:S3ClientConfig = {
      credentials: {
        accessKeyId: config.awsKey,
        secretAccessKey: config.secretKey ? config.secretKey : '',
      },
      region: config.awsRegion,
    };
    const awsclient = new S3Client(s3Config);
    this.s3client = awsclient;
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
   * Add file to the upload queue
   *
   * @param file File to upload
   * @returns Promise (resolve or reject)
   */
  async add(file:File): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof file === 'undefined' || typeof file === 'undefined') {
        return reject('Missing file');
      }
      if (file.name === '') {
        return reject('Missing file name');
      };
      const fileName:string = s3EncodedObjectName(file.name);
      const fileToUpload:File = new File([file], fileName, {type: file.type});
      const fileUpload = new FileUpload(fileToUpload, this.s3client, this.config);
      fileUpload.start().then((uploadId:string) => {
        fileUpload.uploadStats$.subscribe((stats) => {
          this.uploadProgress.next({stats, filename: fileName, uploadId: uploadId});
        });
        resolve();
      }).catch(err => {
        console.error(err);
        reject(err);
      });
        // console.log('got the upload id: ', uploadId);
        // if (uploadId) {
        //   this.queue.push(fileToUpload);
        //   this.pendingFiles[fileUpload.fileKey] = fileUpload;
        // }
    });
  }
}
