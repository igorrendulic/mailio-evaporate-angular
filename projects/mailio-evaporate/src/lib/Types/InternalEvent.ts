import { UploadStatus } from "../mailio-evaporate-types";

export interface InternalEvent {
  type: UploadStatus;
  payload: Error | any;
}

export interface InternalEventPayload {
  error?: Error;
  success?: any;
}
