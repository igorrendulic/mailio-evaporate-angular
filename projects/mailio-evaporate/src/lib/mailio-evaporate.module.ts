import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MailioEvaporateService, MAILIO_EVAPORATE_CONFIG } from '../public-api';
import { MailioEvaporateConfig } from './mailio-evaporate-types';


@NgModule({
  declarations: [],
  imports: [
    CommonModule
  ],
})
export class MailioEvaporateModule {
  static forRoot(mailioConfig: MailioEvaporateConfig): ModuleWithProviders<MailioEvaporateModule> {
    const rv:ModuleWithProviders<MailioEvaporateModule> = {
      ngModule: MailioEvaporateModule,
      providers: [
        MailioEvaporateService, { provide: MAILIO_EVAPORATE_CONFIG, useValue: mailioConfig }
      ],
    }
    return rv;
  };
 }
