import { UploadStatus } from "./UploadConstants";

export interface InternalEvent {
  type: UploadStatus;
  payload: Error | any;
}

export interface InternalEventPayload {
  error?: Error;
  success?: any;
}
