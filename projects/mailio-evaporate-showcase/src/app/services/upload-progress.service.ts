import { Injectable } from '@angular/core';
import { UploadStats } from 'projects/mailio-evaporate/src/public-api';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UploadProgressService {

  private uploadProgress = new BehaviorSubject<UploadStats[]>([]);

  constructor() {}

  public getUploadProgress(): Observable<UploadStats[]> {
    return this.uploadProgress;
  }

  public setUploadProgress(uploadStats: UploadStats[]) {
    this.uploadProgress.next(uploadStats);
  }
}
