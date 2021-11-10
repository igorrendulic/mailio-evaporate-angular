import { UploadStats } from "./UploadStats";

export interface EvaporateProgress {
  stats: UploadStats;
  filename: string;
  uploadId?: string;
}
