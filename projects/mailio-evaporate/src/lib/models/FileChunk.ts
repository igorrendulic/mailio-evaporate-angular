import { CompletedPart } from "@aws-sdk/client-s3";

export interface FileChunk {
  chunk: ArrayBuffer;
  partNumber: number;
  status: string;
  ContentMD5: string;
  completedPart: CompletedPart;
}
