import { TestBed, waitForAsync } from '@angular/core/testing';
import { MAILIO_EVAPORATE_CONFIG } from './config';

import { MailioEvaporateService } from './mailio-evaporate.service';
import { s3EncodedObjectName } from './Utils/Utils';
import { HttpRequest } from "@aws-sdk/protocol-http";
import { SignatureV4, SignatureV4CryptoInit, SignatureV4Init } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { MailioAWSSignatureV4 } from './awsAuthPlugin/MailioAwsSignatureV4';
import { MailioSignatureInit } from './awsAuthPlugin/mailioSignatureInit';
import { rejects } from 'assert';
import { UploadStats } from './Types/UploadStats';

interface environemntVariables {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  AWS_BUCKET: string;
}

const minimalRequest = new HttpRequest({
  method: "POST",
  protocol: "https:",
  path: "/",
  headers: {
    host: "foo.us-bar-1.amazonaws.com",
  },
  hostname: "foo.us-bar-1.amazonaws.com",
});

const httpRequestOptions = {
  method: "POST",
  protocol: "https:",
  path: "/",
  headers: {},
  hostname: "foo.us-east-1.amazonaws.com",
};

describe('MailioEvaporateService', () => {
  let service: MailioEvaporateService;

  beforeEach(() => {
    var request = new XMLHttpRequest();
    request.open('GET', '/base/env.json', false);  // `false` makes the request synchronous
    request.send(null);

    let envs:environemntVariables = {
      AWS_ACCESS_KEY_ID: '',
      AWS_SECRET_ACCESS_KEY: '',
      AWS_REGION: '',
      AWS_BUCKET: ''
    };

    if (request.status === 200) {
      let envVars = request.responseText;
      envs = JSON.parse(envVars);
    }

    TestBed.configureTestingModule({
      providers: [{provide: MAILIO_EVAPORATE_CONFIG, useValue: {
        awsKey: envs.AWS_ACCESS_KEY_ID,
        bucket: envs.AWS_BUCKET,
        awsRegion: envs.AWS_REGION,
        partSize: 5 * 1024 * 1024, // 5 Mb is minimun chunk size
        awsService: 's3',
        authServerUrl: 'http://localhost:8080/sign_auth',
        maxConcurrentParts: 1,
        transformPart: async (part:ArrayBuffer) => {
          try {
            const p = await new Promise<ArrayBuffer>((resolve) => {
              console.log('transformer called: ', part);
              resolve(part);
            });
          } catch (err) {
            console.error(err);
          }
        }
      }}]
    });
    service = TestBed.inject(MailioEvaporateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('s3objectname', () => {
    const name = 'testobject/whereis/some/file!_*.txt';
    const filename = s3EncodedObjectName(name);
    expect(decodeURIComponent(filename)).toEqual(name);
  });

  it('on progress check', (done) => {
    spyOn(service, 'listDanglingUploads').and.returnValue(Promise.resolve([]));
    service.listDanglingUploads().then((uploads) => {
      console.log('uploads', uploads);
      expect(uploads).toEqual([]);
      done();
    });
  });

  it('start upload test: ', waitForAsync(() => {
      fetch('/base/test/images/Large-Sample-png-Image-download-for-Testing.png', { cache: 'no-store', headers: { 'pragma': 'no-cache', 'cache-control': 'no-store' } }).then(res => {
        if (res.ok) {
          expect(res.ok).toBeTruthy();

          const bodyPromise = res.arrayBuffer();
          bodyPromise.then(body => {
            let part = new Uint8Array(body!);
            const blob = new Blob([part]);
            const file = new File([blob], 'Large-Sample-png-Image-download-for-Testing.png', {type: 'image/png'});

            service.uploads.subscribe((stats) => {
              console.log(stats);
            })

            service.add(file, 'igor/test').then((uploadId:string) => {
              console.log('succesfully added to queue');
              setTimeout(() => {
                service.pause(uploadId).then(() => {
                  console.log('paused with upload id: ', uploadId);
                });
              }, 300);

              setTimeout(() => {
                service.resume(uploadId).then(() => {
                  console.log('resumed with upload id: ', uploadId);
                });
              }, 5000);
            }).catch(err => {
              console.error(err);
              throw new Error(err);
            });;
          });

        } else {
          throw new Error('Failed to load image');
        }
      }).catch(err => {
        throw new Error('Failed to load image');
      });
    }
  ));

  it('validate aws v4 signature', waitForAsync(async () => {
    const presigningOptions = {
      expiresIn: 1800,
      signingDate: new Date("2000-01-01T00:00:00.000Z"),
    };
    const signerMailioInit: MailioSignatureInit = {
      service: "foo",
      region: "us-bar-1",
      sha256: Sha256,
      awsCredentials: {
        accessKeyId: "foo",
      },
      authServerUrl: "http://localhost:8080/sign_auth",
    };
    const signerInit: SignatureV4Init & SignatureV4CryptoInit = {
      service: "foo",
      region: "us-bar-1",
      sha256: Sha256,
      credentials: {
        accessKeyId: "foo",
        secretAccessKey: ""
      }
    }
    const mailioSigner = new MailioAWSSignatureV4(signerMailioInit);
    const signer = new SignatureV4(signerInit);
    const originalRequest = await signer.sign(minimalRequest, presigningOptions);
    const mailioRequest = await mailioSigner.signAwsRequest(minimalRequest, presigningOptions);

    expect(originalRequest.headers).toBeTruthy();
    expect(mailioRequest.headers).toBeTruthy();

    expect(originalRequest.headers['Authorization']).toEqual(mailioRequest.headers['Authorization']);

  }));

});
