export interface MailioEvaporateConfig {
  maxConcurrentParts?: number,
  partSize?: number,
  bucket: string,
  retryBackoffPower?: number,
  maxRetryBackoffSecs?: number,
  progressIntervalMS?: number,
  awsKey: string,
  secretKey?:string,
  awsRegion?: string,
  abortCompletionThrottlingMs?: number,
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
  }
  if (!config.maxConcurrentParts) {
    config.maxConcurrentParts = 5;
  }
  if (!config.retryBackoffPower) {
    config.retryBackoffPower = 2;
  }
  if (!config.maxRetryBackoffSecs) {
    config.maxRetryBackoffSecs = 5;
  }
  if (!config.awsRegion) {
    config.awsRegion = 'us-east-1';
  }
  if (!config.abortCompletionThrottlingMs) {
    config.abortCompletionThrottlingMs = 1000;
  }
};
