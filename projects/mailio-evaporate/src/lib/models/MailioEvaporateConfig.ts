export interface MailioEvaporateConfig {
  maxConcurrentParts?: number,
  partSize?: number,
  bucket: string,
  presignUrl: string,
  awsKey: string,
  awsRegion: string,
  timeOffsetMs?: number,
  awsService: string,
  transformPart?: (part: ArrayBuffer, isFirst:boolean, isLast:boolean) => Promise<ArrayBuffer>
}

/**
 * Validate if config correct and set default values if none set, otherwise returns Error
 * @param config MailioEvaporateConfig
 */
export const validateConfig = (config: MailioEvaporateConfig): void  => {
  const supported:boolean = !(typeof File === 'undefined' || typeof Blob === 'undefined' || typeof Promise === 'undefined');
  if (!supported) {
    throw new Error('Browser does not support File, Blob or Promise');
  }
  if (typeof Blob === 'undefined' || typeof (Blob.prototype.slice) === 'undefined') {
    throw new Error('Evaporate requires support for Blob [webkitSlice || mozSlice || slice]');
  }
  if (!config.bucket) {
    throw new Error("The AWS 'bucket' option must be present.");
  }
  if (!config.partSize) {
    config.partSize = 5 * 1024 * 1024; // 5MB
  } else {
    if (config.partSize < 5 * 1024 * 1024) {
      throw new Error('The AWS "partSize" option must be at least 5MB.');
    }
  }

  if (!config.maxConcurrentParts) {
    config.maxConcurrentParts = 5;
  }
  if (!config.awsRegion) {
    config.awsRegion = 'us-east-1';
  }
};
