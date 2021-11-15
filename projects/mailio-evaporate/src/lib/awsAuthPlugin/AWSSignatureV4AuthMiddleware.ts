import { HttpRequest } from "@aws-sdk/types";
import { HttpRequest as ProtocolHttpRequest } from "@aws-sdk/protocol-http";
import { MailioAWSSignatureV4 } from "./MailioAwsSignatureV4";

export const awsSignatureV4AuthMiddleware = (signer: MailioAWSSignatureV4) => (next: any): any => async (args: any) => {
  if (!ProtocolHttpRequest.isInstance(args.request)) return next(args);
  const request = args.request as HttpRequest;
  // TODO: SOURCE: https://github.com/aws/aws-sdk-js-v3/blob/179afb9706f2753fcdc5353abf26c10014e91fee/packages/signature-v4/src/SignatureV4.ts

  const presigningOptions = {
    expiresIn: 1800,
    signingDate: new Date(),
  };

  const signedRequest = await signer.signAwsRequest(request, presigningOptions)
  return next({
    ...args,
    request: signedRequest,
   });

   // TODO: handle clock drift

  //  const { headers } = output.response as any;
  //     const dateHeader = headers && (headers.date || headers.Date);
  //     if (dateHeader) {
  //       options.systemClockOffset = getUpdatedSystemClockOffset(dateHeader, options.systemClockOffset);
  //   }
}
