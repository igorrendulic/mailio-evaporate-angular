import { HashConstructor, Provider } from '@aws-sdk/types';

export interface MailioSignatureInit {
  /** authorization server URL (e.g. http://localhost:8081/sign_auth)
  * where crestion of authorization takes place
  */
  authServerUrl: string;
  /**
   * The service signing name.
   */
  service: string;
  /**
   * The region name or a function that returns a promise that will be
   * resolved with the region name.
   */
  region: string | Provider<string>;
  /**
   * The credentials with which the request should be signed or a function
   * that returns a promise that will be resolved with credentials.
   */
  awsCredentials: AwsCredentials;
  /**
   * A constructor function for a hash object that will calculate SHA-256 HMAC
   * checksums.
   */
  sha256: HashConstructor;
  /**
   * Whether to uri-escape the request URI path as part of computing the
   * canonical request string. This is required for every AWS service, except
   * Amazon S3, as of late 2017.
   *
   * @default [true]
   */
  uriEscapePath?: boolean;
  /**
   * Whether to calculate a checksum of the request body and include it as
   * either a request header (when signing) or as a query string parameter
   * (when presigning). This is required for AWS Glacier and Amazon S3 and optional for
   * every other AWS service as of late 2017.
   *
   * @default [true]
   */
  applyChecksum?: boolean;
}

/**
 * Custom mailio credentials which are converted to AWS Credentials for purposes of authorizing a request
 */
export interface AwsCredentials {
   /**
     * AWS access key ID
     */
    readonly accessKeyId: string;
    /**
     * A security or session token to use with these credentials. Usually
     * present for temporary credentials.
     */
    readonly sessionToken?: string;
    /**
     * A {Date} when these credentials will no longer be accepted.
     */
    readonly expiration?: Date;
}
