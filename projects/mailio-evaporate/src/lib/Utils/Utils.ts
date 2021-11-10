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


