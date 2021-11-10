import { UploadStatus } from "./UploadConstants";

export interface UploadStats {
  speed: number;
  readableSpeed: string;
  // loaded: number; // number of uploaded files bytes
  totalUploaded: number;
  remainingSize: number,
  secondsLeft: number,
  fileSize: number,
  error?: Error,
  message?: string,
  progress: number,
  status: UploadStatus,
}
