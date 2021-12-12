import { Component, OnInit } from '@angular/core';
import { MailioEvaporateService } from 'projects/mailio-evaporate/src/public-api';
import { FileHandle } from '../../directives/drag-and-drop.directive';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss']
})
export class FileUploadComponent implements OnInit {

  errorMessage:string = '';

  constructor(private evaporate:MailioEvaporateService) {
  }

  ngOnInit(): void {
    this.evaporate.uploads.subscribe((stats) => {
      console.log('upload progress: ', stats);
    });
  }

  /**
   * Handling files dropped into the upload zone
   * @param files
   */
  filesDropped(files: FileHandle[]): void {
    files.forEach(fileHandle => {
      const isValid:boolean = this.validateFile(fileHandle.file);
      if (!isValid) {
        return;
      }
    });
    // upload validates files
    files.forEach(fileHandle => {
      this.evaporate.add(fileHandle.file).then((uploadId:string) => {
        console.log('file added: ', uploadId);
      }).catch((err) => {
        console.error(err);
        this.errorMessage = 'failed to upload file. check your configuration';
      });
    });
  }

  /**
   * Validate files to be images only
   * @param file
   * @returns
   */
  validateFile(file:File):boolean {
    let type = file.type;
    if (!type.startsWith("image")) {
      this.errorMessage = "Only images allowed";
      return false;
    }
    return true;
  }


  /**
   *
   * @param files Files added by clicking on the upload button
   */
  fileAdded(files: any) {
    this.errorMessage = '';
    console.log('files added: ', files);
  }

}
