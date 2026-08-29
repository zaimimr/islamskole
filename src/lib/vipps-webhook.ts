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
  "epayments.payment.terminated.v1",
];

function extractSignature(authorization: string): string | null {
  const match = authorization.match(
    /^HMAC-SHA256\s+SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=([^&\s]+)$/i,
  );
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
  nowMs?: number;
  toleranceMs?: number;
};

export function verifyVippsSignature({
  rawBody,
  method,
  pathAndQuery,
  headers,
  secret,
  nowMs = Date.now(),
  toleranceMs = 5 * 60 * 1000,
}: VippsSignatureInput): boolean {
  const authorization = headers.get("authorization");
  const date = headers.get("x-ms-date");
  const providedContentHash = headers.get("x-ms-content-sha256");

  const hosts = uniqueValues([
    headers.get("x-forwarded-host"),
    headers.get("host"),
  ]);
  if (
    !authorization ||
    !date ||
    !providedContentHash ||
    hosts.length === 0
  ) {
    return false;
  }

  const requestTime = Date.parse(date);
  if (
    !Number.isFinite(requestTime) ||
    Math.abs(nowMs - requestTime) > toleranceMs
  ) {
    return false;
  }

  const providedSignature = extractSignature(authorization);
  if (!providedSignature) return false;

  const contentHash = createHash("sha256")
    .update(rawBody, "utf8")
    .digest("base64");

  if (!safeEqualBase64(contentHash, providedContentHash)) {
    return false;
  }

  for (const host of hosts) {
    const signedString = `${method.toUpperCase()}\n${pathAndQuery}\n${date};${host};${contentHash}`;
    const candidate = createHmac("sha256", secret)
      .update(signedString, "utf8")
      .digest("base64");
    if (safeEqualBase64(candidate, providedSignature)) return true;
  }

  return false;
}

const PAYMENT_EVENT_NAMES = new Set([
  "CREATED",
  "ABORTED",
  "EXPIRED",
  "CANCELLED",
  "CAPTURED",
  "REFUNDED",
  "AUTHORIZED",
  "TERMINATED",
]);

export type VippsWebhookPayload = {
  msn: string;
  reference: string;
  pspReference: string;
  name: string;
  amount: { currency: "NOK"; value: number };
  timestamp: string;
  success: boolean;
};

export function parseVippsWebhookPayload(
  rawBody: string,
  expectedMsn: string,
): VippsWebhookPayload | null {
  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const amount = body.amount;
  if (!amount || typeof amount !== "object" || Array.isArray(amount)) {
    return null;
  }
  const amountRow = amount as Record<string, unknown>;

  if (
    typeof body.msn !== "string" ||
    !/^\d{4,10}$/.test(body.msn) ||
    body.msn !== expectedMsn ||
    typeof body.reference !== "string" ||
    !/^[a-zA-Z0-9-]{8,64}$/.test(body.reference) ||
    typeof body.pspReference !== "string" ||
    body.pspReference.length === 0 ||
    typeof body.name !== "string" ||
    !PAYMENT_EVENT_NAMES.has(body.name) ||
    amountRow.currency !== "NOK" ||
    typeof amountRow.value !== "number" ||
    !Number.isSafeInteger(amountRow.value) ||
    amountRow.value < 0 ||
    typeof body.timestamp !== "string" ||
    !Number.isFinite(Date.parse(body.timestamp)) ||
    typeof body.success !== "boolean"
  ) {
    return null;
  }

  return {
    msn: body.msn,
    reference: body.reference,
    pspReference: body.pspReference,
    name: body.name,
    amount: { currency: "NOK", value: amountRow.value },
    timestamp: body.timestamp,
    success: body.success,
  };
}
