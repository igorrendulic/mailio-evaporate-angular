import { Component, OnInit } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { UploadStats } from 'projects/mailio-evaporate/src/public-api';
import { UploadProgressService } from '../../services/upload-progress.service';

@Component({
  selector: 'app-upload-progress',
  templateUrl: './upload-progress.component.html',
  styleUrls: ['./upload-progress.component.scss']
})
export class UploadProgressComponent implements OnInit {

  files: UploadStats[] = [];

  constructor(
    private _bottomSheetRef: MatBottomSheetRef<UploadProgressComponent>,
    private uploadProgressService: UploadProgressService) {
  }

  ngOnInit(): void {
    this.uploadProgressService.getUploadProgress().subscribe((stats:UploadStats[]) => {
      this.files = stats;
    });
  }

  closeSheet(): void {
    console.log('close sheet');
    this._bottomSheetRef.dismiss();
  }
}
