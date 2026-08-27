import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_PATH = "/api/vipps/webhook";

export const WEBHOOK_EVENTS = [
  "epayments.payment.created.v1",
  "epayments.payment.authorized.v1",
  "epayments.payment.captured.v1",
  "epayments.payment.cancelled.v1",
  "epayments.payment.refunded.v1",
  "epayments.payment.aborted.v1",
  "epayments.payment.expired.v1",
];

function extractSignature(authorization: string): string | null {
  const match = authorization.match(/Signature=([^&\s]+)/i);
  return match ? match[1] : null;
}

function safeEqualBase64(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "base64");
  const bufferB = Buffer.from(b, "base64");
  if (bufferA.length === 0 || bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

function uniqueValues(values: (string | null | undefined)[]): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ];
}

export type VippsSignatureInput = {
  rawBody: string;
  method: string;
  pathAndQuery: string;
  headers: Headers;
  secret: string;
};

export function verifyVippsSignature({
  rawBody,
  method,
  pathAndQuery,
  headers,
  secret,
}: VippsSignatureInput): boolean {
  const authorization = headers.get("authorization");
  const date = headers.get("x-ms-date") ?? headers.get("date");

  const hosts = uniqueValues([
    headers.get("x-forwarded-host"),
    headers.get("host"),
  ]);
  const paths = uniqueValues([pathAndQuery, WEBHOOK_PATH]);

  if (!authorization || !date || hosts.length === 0) return false;

  const providedSignature = extractSignature(authorization);
  if (!providedSignature) return false;

  const contentHash = createHash("sha256")
    .update(rawBody, "utf8")
    .digest("base64");

  const providedContentHash = headers.get("x-ms-content-sha256");
  if (
    providedContentHash &&
    !safeEqualBase64(contentHash, providedContentHash)
  ) {
    return false;
  }

  const keys = [secret, Buffer.from(secret, "base64")];

  for (const host of hosts) {
    for (const path of paths) {
      const signedString = `${method.toUpperCase()}\n${path}\n${date};${host};${contentHash}`;
      for (const key of keys) {
        const candidate = createHmac("sha256", key)
          .update(signedString, "utf8")
          .digest("base64");
        if (safeEqualBase64(candidate, providedSignature)) return true;
      }
    }
  }

  return false;
}
