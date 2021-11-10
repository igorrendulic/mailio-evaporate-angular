import { async, TestBed, waitForAsync } from '@angular/core/testing';
import { MAILIO_EVAPORATE_CONFIG } from './config';

import { MailioEvaporateService } from './mailio-evaporate.service';
import { MailioEvaporateConfig } from './models/MailioEvaporateConfig';
import { FileUpload } from './Upload/FileUpload';
import { s3EncodedObjectName } from './Utils/Utils';

describe('MailioEvaporateService', () => {
  let service: MailioEvaporateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{provide: MAILIO_EVAPORATE_CONFIG, useValue: {
        awsKey: '***REMOVED***',
        secretKey: '***REMOVED***',
        bucket: '***REMOVED***',
        awsRegion: 'us-west-2',
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
            const fileUpload = new FileUpload(file, service.s3client, service.config);
            fileUpload.uploadStats$.subscribe(stats => {
              console.log('upload stats: ', stats);
            });
            fileUpload.start();
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
