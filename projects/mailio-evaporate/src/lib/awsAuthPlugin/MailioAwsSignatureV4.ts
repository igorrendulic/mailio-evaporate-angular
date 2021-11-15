import { Sha256 } from '@aws-crypto/sha256-js';
import { createScope, getCanonicalHeaders, getCanonicalQuery, getPayloadHash, getSigningKey, normalizeCredentialsProvider, normalizeRegionProvider, prepareRequest, SignatureV4CryptoInit, SignatureV4Init } from '@aws-sdk/signature-v4';
import { HttpRequest, HeaderBag, Credentials, Provider, HashConstructor, RequestSigningArguments } from '@aws-sdk/types';
import { ALGORITHM_IDENTIFIER, AMZ_DATE_HEADER, AUTH_HEADER, SHA256_HEADER, TOKEN_HEADER } from '../Constants';
import { toHex } from '../Utils/Utils';
import { formatDate, getCanonicalHeaderList, hasHeader } from './awsSignatureV4Utils';

export class MailioAWSSignatureV4 {
  private readonly service: string;
  private readonly regionProvider: Provider<string>;
  private readonly credentialProvider: Provider<Credentials>;
  private readonly uriEscapePath: boolean;
  private readonly applyChecksum: boolean;
  private readonly sha256: HashConstructor;


  constructor({
    applyChecksum,
    credentials,
    region,
    service,
    sha256,
    uriEscapePath = true
  }: SignatureV4Init & SignatureV4CryptoInit) {
    this.service = service;
    this.uriEscapePath = uriEscapePath;
    // default to true if applyChecksum isn't set
    this.applyChecksum = typeof applyChecksum === "boolean" ? applyChecksum : true;
    this.regionProvider = normalizeRegionProvider(region);
    this.credentialProvider = normalizeCredentialsProvider(credentials);
    this.sha256 = sha256;
  }

  async signAwsRequest(requestToSign:HttpRequest, {
    signingDate = new Date(),
    signableHeaders,
    unsignableHeaders,
    signingRegion,
    signingService
    }: RequestSigningArguments): Promise<HttpRequest> {
    const credentials = await this.credentialProvider();
    const region = signingRegion ?? (await this.regionProvider());

    const request = prepareRequest(requestToSign);
    const { longDate, shortDate } = formatDate(signingDate);

    const scope = createScope(shortDate, region, signingService ?? this.service);

    request.headers[AMZ_DATE_HEADER] = longDate;
      if (credentials.sessionToken) {
        request.headers[TOKEN_HEADER] = credentials.sessionToken;
      }

      const payloadHash = await getPayloadHash(request, Sha256);
      if (!hasHeader(SHA256_HEADER, request.headers) && this.applyChecksum) {
        request.headers[SHA256_HEADER] = payloadHash;
      }

      const canonicalHeaders = getCanonicalHeaders(request, unsignableHeaders, signableHeaders);
      const stringToSign = await this.createStringToSign(longDate, scope, this.createCanonicalRequest(request, canonicalHeaders, payloadHash));
      const signature = await this.authorize(signingService ?? this.service, region, shortDate, scope, stringToSign);

      request.headers[AUTH_HEADER] =
      `${ALGORITHM_IDENTIFIER} ` +
        `Credential=${credentials.accessKeyId}/${scope}, ` +
        `SignedHeaders=${getCanonicalHeaderList(canonicalHeaders)}, ` +
        `Signature=${signature}`;

      return request;
    }

    /**
     * Canonical request to be sent to server as payload to sign
     * ! Do not remove the newline between sorted headers and sortedheaders join
     *
     * @param request HttpRequest (request to create a canonical request from)
     * @param canonicalHeaders HeaderBah (headers to be included in the canonical request)
     * @param payloadHash (sha256 of the payload)
     * @returns string (canonical request)
     */
    private createCanonicalRequest(request: HttpRequest, canonicalHeaders: HeaderBag, payloadHash: string): string {
      const sortedHeaders = Object.keys(canonicalHeaders).sort();
      return `${request.method}
${this.getCanonicalPath(request)}
${getCanonicalQuery(request)}
${sortedHeaders.map((name) => `${name}:${canonicalHeaders[name]}`).join("\n")}

${sortedHeaders.join(";")}
${payloadHash}`;
    }

    /**
     * URL path should be escaped by default
     * @param param0
     * @returns
     */
    private getCanonicalPath({ path }: HttpRequest): string {
      if (this.uriEscapePath) {
        const doubleEncoded = encodeURIComponent(path.replace(/^\//, ""));
        return `/${doubleEncoded.replace(/%2F/g, "/")}`;
      }

      return path;
    }

  private async createStringToSign(
      longDate: string,
      credentialScope: string,
      canonicalRequest: string
    ): Promise<string> {
      const hash = new Sha256();
      hash.update(canonicalRequest);
      const hashedRequest = await hash.digest();

      return `${ALGORITHM_IDENTIFIER}
${longDate}
${credentialScope}
${toHex(hashedRequest)}`;
    }

    /**
     * Authorize by creating a signature on server side (sign_auth
     * TODO: use the config to get our the server URL
     * @param service
     * @param region
     * @param shortDate
     * @param scope
     * @param stringToSign
     * @returns
     */
    private async authorize(service:string, region:string, shortDate:string, scope:string, stringToSign:string): Promise<string> {
      return new Promise<string>((resolve, reject) => {
      var xhr = new XMLHttpRequest();
        const signUrl = ["http://localhost:8080/sign_auth",
        '?region=',encodeURIComponent(region),
        '&date=', encodeURIComponent(shortDate),
        '&scope=', encodeURIComponent(scope),
        '&tosign=', encodeURIComponent(stringToSign),
        '&service=', encodeURIComponent(service)].join('');

        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            if (xhr.status === 200) {

              resolve(xhr.responseText);
            } else {
              if ([401, 403].indexOf(xhr.status) > -1) {
                var reason = "status:" + xhr.status;
                console.error('Permission denied ' + reason, xhr.status);
                return reject(reason);
              }
              reject("Signature fetch returned status: " + xhr.status);
            }
          }
        };

        xhr.onerror = function (xhr) {
          console.error('authorizedSend transport error: ', xhr);
          reject('authorizedSend transport error: ' + xhr);
        };

        xhr.open('GET', signUrl);
        xhr.send();
      });
    }
}
