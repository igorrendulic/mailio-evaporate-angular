import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DragAndDropDirective } from './directives/drag-and-drop.directive';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { MailioEvaporateModule, MailioEvaporateConfig } from 'projects/mailio-evaporate/src/public-api';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { UploadProgressComponent } from './components/upload-progress/upload-progress.component';

const mailioConfig: MailioEvaporateConfig = {
    bucket: 'mailio-development',
    awsRegion: 'us-west-2',
    awsKey: 'AKIARYOIXWEDVV2PWN5N',
    partSize: 5 * 1024 * 1024, // 5 Mb is minimun chunk size
    awsService: 's3',
    authServerUrl: 'http://localhost:8080/sign_auth',
    maxConcurrentParts: 1,
}

@NgModule({
  declarations: [
    AppComponent,
    DragAndDropDirective,
    FileUploadComponent,
    UploadProgressComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatBottomSheetModule,
    MatProgressBarModule,
    MatListModule,
    MailioEvaporateModule.forRoot(mailioConfig),
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
