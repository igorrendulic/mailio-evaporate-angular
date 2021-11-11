import { TestBed, waitForAsync } from '@angular/core/testing';
import { MAILIO_EVAPORATE_CONFIG } from './config';

import { MailioEvaporateService } from './mailio-evaporate.service';
import { s3EncodedObjectName } from './Utils/Utils';

interface environemntVariables {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  AWS_BUCKET: string;
}

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
    }

    if (request.status === 200) {
      let envVars = request.responseText;
      envs = JSON.parse(envVars);
    }

    TestBed.configureTestingModule({
      providers: [{provide: MAILIO_EVAPORATE_CONFIG, useValue: {
        awsKey: envs.AWS_ACCESS_KEY_ID,
        secretKey: envs.AWS_SECRET_ACCESS_KEY,
        bucket: envs.AWS_BUCKET,
        awsRegion: envs.AWS_REGION,
        partSize: 5 * 1024 * 1024, // 5 Mb is minimun chunk size
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
            // add listener to the file upload
            service.uploadProgress$.subscribe(progress => {
              console.log('progress: ', progress);
            });
            // add file to queue for upload
            service.add(file).then(() => {
              console.log('succesfully added to queue');
            });
          });

        } else {
          throw new Error('Failed to load image');
        }
      }).catch(err => {
        throw new Error('Failed to load image');
      });
    }
  ));
});
