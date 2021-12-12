import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DragAndDropDirective } from './directives/drag-and-drop.directive';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { MailioEvaporateConfig } from 'projects/mailio-evaporate/src/lib/Types/MailioEvaporateConfig';
import { MailioEvaporateModule, MailioEvaporateService } from 'projects/mailio-evaporate/src/public-api';

const mailioConfig: MailioEvaporateConfig = {
    bucket: 'mailio-development',
    awsRegion: 'eu-east-1',
    awsKey: 'AKIAJX7ZQ7X7Z7Z7Z7Z7',
    partSize: 5 * 1024 * 1024, // 5 Mb is minimun chunk size
    awsService: 's3',
    authServerUrl: 'http://localhost:8080/sign_auth',
    maxConcurrentParts: 1,
}

@NgModule({
  declarations: [
    AppComponent,
    DragAndDropDirective,
    FileUploadComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    MailioEvaporateModule.forRoot(mailioConfig),
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
