import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import {
  parseVippsWebhookPayload,
  verifyVippsSignature,
  WEBHOOK_EVENTS,
} from "../src/lib/vipps-webhook.ts";

const rawBody = JSON.stringify({
  msn: "123456",
  reference: "isk-payment-123",
  pspReference: "psp-123",
  name: "TERMINATED",
  amount: { currency: "NOK", value: 10_000 },
  timestamp: "2026-08-28T10:00:00.000Z",
  success: true,
});
const secret = "webhook-secret";
const date = "Fri, 28 Aug 2026 10:00:00 GMT";
const nowMs = Date.parse(date);
const pathAndQuery = "/api/vipps/webhook";
const host = "example.no";
const contentHash = createHash("sha256")
  .update(rawBody, "utf8")
  .digest("base64");
const signature = createHmac("sha256", secret)
  .update(`POST\n${pathAndQuery}\n${date};${host};${contentHash}`, "utf8")
  .digest("base64");

function signedHeaders() {
  return new Headers({
    host,
    "x-ms-date": date,
    "x-ms-content-sha256": contentHash,
    authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
  });
}

test("valid signature passes with all required signed headers", () => {
  assert.equal(
    verifyVippsSignature({
      rawBody,
      method: "POST",
      pathAndQuery,
      headers: signedHeaders(),
      secret,
      nowMs,
    }),
    true,
  );
});

test("missing content hash, stale date, and changed body fail", () => {
  const missingHash = signedHeaders();
  missingHash.delete("x-ms-content-sha256");

  assert.equal(
    verifyVippsSignature({
      rawBody,
      method: "POST",
      pathAndQuery,
      headers: missingHash,
      secret,
      nowMs,
    }),
    false,
  );
  assert.equal(
    verifyVippsSignature({
      rawBody,
      method: "POST",
      pathAndQuery,
      headers: signedHeaders(),
      secret,
      nowMs: nowMs + 6 * 60 * 1000,
    }),
    false,
  );
  assert.equal(
    verifyVippsSignature({
      rawBody: `${rawBody} `,
      method: "POST",
      pathAndQuery,
      headers: signedHeaders(),
      secret,
      nowMs,
    }),
    false,
  );
});

test("payload requires matching MSN and complete payment event fields", () => {
  const payload = parseVippsWebhookPayload(rawBody, "123456");
  assert.equal(payload?.name, "TERMINATED");
  assert.equal(parseVippsWebhookPayload(rawBody, "654321"), null);
  assert.equal(
    parseVippsWebhookPayload(
      JSON.stringify({ ...JSON.parse(rawBody), timestamp: "invalid" }),
      "123456",
    ),
    null,
  );
  assert.ok(WEBHOOK_EVENTS.includes("epayments.payment.terminated.v1"));
});
