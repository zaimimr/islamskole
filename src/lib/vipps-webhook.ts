import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function extractSignature(authorization: string): string | null {
  const trimmed = authorization.trim();
  const lastSegment = trimmed.split(";").pop()?.trim();
  if (lastSegment && lastSegment !== trimmed) return lastSegment;
  const spaceParts = trimmed.split(" ");
  return spaceParts.length > 1 ? spaceParts[spaceParts.length - 1] : null;
}

function safeEqualBase64(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "base64");
  const bufferB = Buffer.from(b, "base64");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function verifyVippsSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): boolean {
  const authorization = headers.get("authorization");
  const date = headers.get("x-ms-date") ?? headers.get("date");
  const host = headers.get("host");
  const pathAndQuery = headers.get("x-ms-path") ?? headers.get("path");

  if (!authorization || !date || !host || !pathAndQuery) return false;

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

  const signedString = `${date}\n${host}${pathAndQuery}\n${contentHash}`;
  const expectedSignature = createHmac("sha256", secret)
    .update(signedString, "utf8")
    .digest("base64");

  return safeEqualBase64(expectedSignature, providedSignature);
}
