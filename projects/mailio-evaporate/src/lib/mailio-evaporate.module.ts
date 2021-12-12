import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MailioEvaporateConfig } from './Types/MailioEvaporateConfig';
import { MAILIO_EVAPORATE_CONFIG } from './config';
import { MailioEvaporateService } from './mailio-evaporate.service';

@NgModule({
  declarations: [],
  imports: [
    CommonModule
  ],
})
export class MailioEvaporateModule {
  static forRoot(mailioConfig: MailioEvaporateConfig): ModuleWithProviders<MailioEvaporateModule> {
    console.log('module init: ', mailioConfig);
    return {
      ngModule: MailioEvaporateModule,
      providers: [
        MailioEvaporateService, { provide: MAILIO_EVAPORATE_CONFIG, useValue: mailioConfig }
      ],
    }
  };
 }
