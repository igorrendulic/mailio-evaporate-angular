import { HeaderBag, DateInput, HashConstructor, Credentials, SourceData } from '@aws-sdk/types';
import { KEY_TYPE_IDENTIFIER, MAX_CACHE_SIZE } from '../Constants';
import { toHex } from '../Utils/Utils';

const signingKeyCache: { [key: string]: Uint8Array } = {};
const cacheQueue: Array<string> = [];
/**
 * Date utils
 */

export const iso8601 = (time: number | string | Date): string =>
  toDate(time)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");

export const toDate = (time: number | string | Date): Date => {
  if (typeof time === "number") {
    return new Date(time * 1000);
  }

  if (typeof time === "string") {
    if (Number(time)) {
      return new Date(Number(time) * 1000);
    }
    return new Date(time);
  }

  return time;
};

export const formatDate = (now: DateInput): { longDate: string; shortDate: string } => {
  const longDate = iso8601(now).replace(/[\-:]/g, "");
  return {
    longDate,
    shortDate: longDate.substr(0, 8),
  };
};

export const hasHeader = (soughtHeader: string, headers: HeaderBag): boolean => {
  soughtHeader = soughtHeader.toLowerCase();
  for (const headerName of Object.keys(headers)) {
    if (soughtHeader === headerName.toLowerCase()) {
      return true;
    }
  }

  return false;
};

/* Get the value of one request header, ignore the case. Return string if header is in the headers, else return undefined */
export const getHeaderValue = (soughtHeader: string, headers: HeaderBag): string | undefined => {
  soughtHeader = soughtHeader.toLowerCase();
  for (const headerName of Object.keys(headers)) {
    if (soughtHeader === headerName.toLowerCase()) {
      return headers[headerName];
    }
  }

  return undefined;
};

/* Delete the one request header, ignore the case. Do nothing if it's not there */
export const deleteHeader = (soughtHeader: string, headers: HeaderBag) => {
  soughtHeader = soughtHeader.toLowerCase();
  for (const headerName of Object.keys(headers)) {
    if (soughtHeader === headerName.toLowerCase()) {
      delete headers[headerName];
    }
  }
};

export const getCanonicalHeaderList = (headers: object): string => Object.keys(headers).sort().join(";");

/**
 * Derive a signing key from its composite parts
 *
 * @param sha256Constructor A constructor function that can instantiate SHA-256
 *                          hash objects.
 * @param credentials       The credentials with which the request will be
 *                          signed.
 * @param shortDate         The current calendar date in the form YYYYMMDD.
 * @param region            The AWS region in which the service resides.
 * @param service           The service to which the signed request is being
 *                          sent.
 */
 export const getSigningKey = async (
  sha256Constructor: HashConstructor,
  credentials: Credentials,
  shortDate: string,
  region: string,
  service: string
): Promise<Uint8Array> => {
  const credsHash = await hmac(sha256Constructor, credentials.secretAccessKey, credentials.accessKeyId);
  const cacheKey = `${shortDate}:${region}:${service}:${toHex(credsHash)}:${credentials.sessionToken}`;
  if (cacheKey in signingKeyCache) {
    return signingKeyCache[cacheKey];
  }

  cacheQueue.push(cacheKey);
  while (cacheQueue.length > MAX_CACHE_SIZE) {
    delete signingKeyCache[cacheQueue.shift() as string];
  }

  let key: SourceData = `AWS4${credentials.secretAccessKey}`;
  for (const signable of [shortDate, region, service, KEY_TYPE_IDENTIFIER]) {
    key = await hmac(sha256Constructor, key, signable);
  }
  return (signingKeyCache[cacheKey] = key as Uint8Array);
};


const hmac = (ctor: HashConstructor, secret: SourceData, data: SourceData): Promise<Uint8Array> => {
  const hash = new ctor(secret);
  hash.update(data);
  return hash.digest();
};
