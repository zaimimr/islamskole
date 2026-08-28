import assert from "node:assert/strict";
import test from "node:test";
import {
  mapVippsPaymentState,
  netPaidAmount,
  vippsIdempotencyKey,
} from "../src/lib/payment-integrity.ts";

test("net paid amount never becomes negative", () => {
  assert.equal(netPaidAmount(10_000, 2_500), 7_500);
  assert.equal(netPaidAmount(10_000, 10_000), 0);
  assert.equal(netPaidAmount(10_000, 12_000), 0);
});

test("partial refund remains captured and full refund becomes refunded", () => {
  assert.equal(mapVippsPaymentState("AUTHORIZED", 10_000, 2_500), "fanget");
  assert.equal(
    mapVippsPaymentState("AUTHORIZED", 10_000, 10_000),
    "refundert",
  );
  assert.equal(mapVippsPaymentState("TERMINATED", 0, 0), "avbrutt");
});

test("provider mutation keys are stable and operation-specific", () => {
  const first = vippsIdempotencyKey("refund", "isk-reference-123", 7_500);
  const retry = vippsIdempotencyKey("refund", "isk-reference-123", 7_500);
  const otherAmount = vippsIdempotencyKey(
    "refund",
    "isk-reference-123",
    5_000,
  );
  const capture = vippsIdempotencyKey(
    "capture",
    "isk-reference-123",
    7_500,
  );

  assert.equal(first, retry);
  assert.notEqual(first, otherAmount);
  assert.notEqual(first, capture);
  assert.ok(first.length <= 40);
});
