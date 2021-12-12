import { Component, OnInit } from '@angular/core';
import { MailioEvaporateService } from 'mailio-evaporate';
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
  }

  /**
   * Handling files dropped
   * @param files
   */
  filesDropped(files: FileHandle[]): void {
    files.forEach(fileHandle => {
      const isValid:boolean = this.validateFile(fileHandle.file);
      if (!isValid) {
        return;
      }
    });
  }

  /**
   * Validate each file...only PDF up to 256KB allowed
   * @param file
   * @returns
   */
  validateFile(file:File):boolean {
    let type = file.type;
    if (!type.startsWith("image/png")) {
      this.errorMessage = "Please upload PNG image";
      return false;
    }
    if (file.size > 256000) {
      this.errorMessage = "File too large. Maximum allowed size is 256 Kb";
      return false;
    }
    return true;
  }

  fileAdded(files: any) {
    this.errorMessage = '';
    if (files && files.length > 0) {
      let f = files as File[];
      if (this.validateFile(f[0])) {
      }
    }
  }

}
