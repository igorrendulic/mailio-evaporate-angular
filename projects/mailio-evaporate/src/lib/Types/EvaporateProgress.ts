import { UploadStats } from "../mailio-evaporate-types";

export interface EvaporateProgress {
  stats: UploadStats;
  filename: string;
  uploadId?: string;
}
