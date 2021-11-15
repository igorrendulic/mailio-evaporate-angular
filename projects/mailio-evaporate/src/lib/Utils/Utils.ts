import { S3_EXTRA_ENCODED_CHARS } from "../Constants";

/**
 * Human readable file size
 * @param size (bytes)
 * @returns string (e.g. 34 Kb)
 */
export const readableFileSize = (size:number): string => {
    // Adapted from https://github.com/fkjaekel
    // https://github.com/TTLabs/EvaporateJS/issues/13
    let units = ['B', 'Kb', 'Mb', 'Gb', 'Tb', 'Pb', 'Eb', 'Zb', 'Yb'],
        i = 0;
    while(size >= 1024) {
      size /= 1024;
      ++i;
    }
    return [size.toFixed(2).replace('.00', ''), units[i]].join(" ");
};

/**
 * Encoding object based on S3 rules: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html
 * @param fileName name of the file
 * @returns encoded file name
 */
export const s3EncodedObjectName = (fileName:string): string => {
  let fileParts = fileName.split('/');
  let encodedParts:string[] = [];
  fileParts.forEach(function (p) {
    let buf = [];
    let enc:string = encodeURIComponent(p);
    for (var i = 0; i < enc.length; i++) {
      buf.push(S3_EXTRA_ENCODED_CHARS[enc.charCodeAt(i)] || enc.charAt(i));
    }
    encodedParts.push(buf.join(""));
  });
  return encodedParts.join('/');
}

export const base64ToHex = (str:string): string => {
  for (var i = 0, bin = atob(str.replace(/[ \r\n]+$/, "")), hex = []; i < bin.length; ++i) {
    var tmp = bin.charCodeAt(i).toString(16);
    if (tmp.length === 1) tmp = "0" + tmp;
    hex[hex.length] = tmp;
  }
  return hex.join("");
};

// exploding the URL
export const explodeUri = (url:string) => {
  var p,
      href = url || '/';

  try {
    p = new URL(href);
    p.search = p.search || "";
  } catch (e) {
    p = document.createElement('a');
    p.href = href;
  }

  return {
    protocol: p.protocol, // => "http:"
    hostname: p.hostname, // => "example.com"
    // IE omits the leading slash, so add it if it's missing
    pathname: p.pathname.replace(/(^\/?)/, "/"), // => "/pathname/"
    port: p.port, // => "3000"
    search: (p.search[0] === '?') ? p.search.substr(1) : p.search, // => "search=test"
    hash: p.hash, // => "#hash"
    host: p.host  // => "example.com:3000"
  };
}

// AWS Escape URI style
export const escapeUri = (uri: string): string =>encodeURIComponent(uri).replace(/[!'()*]/g, hexEncode);

// Encoding for AWS to Hex
const hexEncode = (c: string) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`;

const SHORT_TO_HEX: { [key: number]: string } = {};
const HEX_TO_SHORT: { [key: string]: number } = {};

for (let i = 0; i < 256; i++) {
  let encodedByte = i.toString(16).toLowerCase();
  if (encodedByte.length === 1) {
    encodedByte = `0${encodedByte}`;
  }

  SHORT_TO_HEX[i] = encodedByte;
  HEX_TO_SHORT[encodedByte] = i;
}

/**
 * Converts a Uint8Array of binary data to a hexadecimal encoded string.
 *
 * @param bytes The binary data to encode
 */
export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    out += SHORT_TO_HEX[bytes[i]];
  }

  return out;
}

/**
 * Converts a hexadecimal encoded string to a Uint8Array of bytes.
 *
 * @param encoded The hexadecimal encoded string
 */
 export function fromHex(encoded: string): Uint8Array {
  if (encoded.length % 2 !== 0) {
    throw new Error("Hex encoded strings must have an even number length");
  }

  const out = new Uint8Array(encoded.length / 2);
  for (let i = 0; i < encoded.length; i += 2) {
    const encodedByte = encoded.substr(i, 2).toLowerCase();
    if (encodedByte in HEX_TO_SHORT) {
      out[i / 2] = HEX_TO_SHORT[encodedByte];
    } else {
      throw new Error(`Cannot decode unrecognized sequence ${encodedByte} as hexadecimal`);
    }
  }

  return out;
}

export const isArrayBuffer = (arg: any): arg is ArrayBuffer =>
  (typeof ArrayBuffer === "function" && arg instanceof ArrayBuffer) ||
  Object.prototype.toString.call(arg) === "[object ArrayBuffer]";
