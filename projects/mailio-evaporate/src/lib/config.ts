import { InjectionToken } from "@angular/core";
import { MailioEvaporateConfig } from "./models/MailioEvaporateConfig";

export const MAILIO_EVAPORATE_CONFIG = new InjectionToken<MailioEvaporateConfig>('mailio_evaporate_config');
