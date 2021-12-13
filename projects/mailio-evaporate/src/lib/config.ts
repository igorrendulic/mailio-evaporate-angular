import { InjectionToken } from "@angular/core";
import { MailioEvaporateConfig } from "./mailio-evaporate-types";

export const MAILIO_EVAPORATE_CONFIG = new InjectionToken<MailioEvaporateConfig>('mailio_evaporate_config');
