import assert from "node:assert/strict";
import test from "node:test";
import {
  billingDecision,
  capTargetsAtRemaining,
  mapInChunks,
  planFamilyBatch,
  vippsIdempotencyKey,
} from "../src/lib/payment-integrity.ts";

function candidate(overrides) {
  return {
    studentId: "s1",
    name: "Barn",
    className: "Klasse 1",
    familyKey: "f1",
    familyName: "Familie",
    balance: { owed: 500000, remaining: 500000 },
    fallbackAmount: 500000,
    onPlan: false,
    hasOpenLink: false,
    hasRecipients: true,
    ...overrides,
  };
}

test("fritatt child with owed 0 is never billed, even with a class price", () => {
  assert.deepEqual(
    billingDecision({ balance: { owed: 0, remaining: 0 }, fallbackAmount: 500000 }),
    { bill: false, reason: "fritatt" },
  );
});

test("fully covered child is not billed", () => {
  assert.deepEqual(
    billingDecision({ balance: { owed: 500000, remaining: 0 }, fallbackAmount: 500000 }),
    { bill: false, reason: "betalt" },
  );
});

test("partly paid child is billed only the remaining amount", () => {
  assert.deepEqual(
    billingDecision({ balance: { owed: 500000, remaining: 150000 } }),
    { bill: true, amount: 150000 },
  );
});

test("price fallback only applies when no balance row exists", () => {
  assert.deepEqual(billingDecision({ balance: null, fallbackAmount: 500000 }), {
    bill: true,
    amount: 500000,
  });
  assert.deepEqual(billingDecision({ balance: null, fallbackAmount: null }), {
    bill: false,
    reason: "uten_pris",
  });
});

test("families on a payment plan are left to the installment cron", () => {
  assert.deepEqual(
    billingDecision({ balance: { owed: 500000, remaining: 500000 }, onPlan: true }),
    { bill: false, reason: "plan" },
  );
});

test("siblings are grouped into one family line with per-child amounts", () => {
  const plan = planFamilyBatch([
    candidate({ studentId: "a", name: "Aisha", balance: { owed: 500000, remaining: 500000 } }),
    candidate({ studentId: "b", name: "Bilal", balance: { owed: 450000, remaining: 200000 } }),
    candidate({ studentId: "c", name: "Sara", familyKey: "f2", familyName: "Annen" }),
  ]);
  assert.equal(plan.families.length, 2);
  const first = plan.families.find((family) => family.familyKey === "f1");
  assert.equal(first.amount, 700000);
  assert.deepEqual(
    first.children.map((child) => [child.studentId, child.amount]),
    [
      ["a", 500000],
      ["b", 200000],
    ],
  );
  assert.deepEqual(plan.excluded, []);
});

test("exempt, paid, open-link and no-email children are excluded with a reason", () => {
  const plan = planFamilyBatch([
    candidate({ studentId: "fritatt", balance: { owed: 0, remaining: 0 } }),
    candidate({ studentId: "betalt", balance: { owed: 500000, remaining: 0 } }),
    candidate({ studentId: "lenke", hasOpenLink: true }),
    candidate({ studentId: "epost", familyKey: "f3", hasRecipients: false }),
    candidate({ studentId: "fritatt" }),
  ]);
  assert.equal(plan.families.length, 0);
  assert.deepEqual(
    plan.excluded.map((item) => [item.studentId, item.reason]),
    [
      ["fritatt", "fritatt"],
      ["betalt", "betalt"],
      ["lenke", "apen_lenke"],
      ["epost", "ingen_epost"],
    ],
  );
});

test("family targets are capped at what each child still owes", () => {
  const capped = capTargetsAtRemaining(
    [
      { studentId: "a", amount: 500000 },
      { studentId: "b", amount: 200000 },
      { studentId: "c", amount: 100000 },
    ],
    new Map([
      ["a", 300000],
      ["b", 0],
    ]),
  );
  assert.deepEqual(capped, [{ studentId: "a", amount: 300000 }]);
});

test("refund keys differ per refund group even for the same amount", () => {
  const first = vippsIdempotencyKey("refund", "isk-ref", 50000, "group-1");
  const second = vippsIdempotencyKey("refund", "isk-ref", 50000, "group-2");
  const retry = vippsIdempotencyKey("refund", "isk-ref", 50000, "group-1");
  assert.notEqual(first, second);
  assert.equal(first, retry);
  assert.equal(
    vippsIdempotencyKey("capture", "isk-ref", 50000),
    vippsIdempotencyKey("capture", "isk-ref", 50000, undefined),
  );
});

test("mapInChunks keeps order and limits concurrency", async () => {
  let active = 0;
  let peak = 0;
  const result = await mapInChunks([1, 2, 3, 4, 5], 2, async (value) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return value * 2;
  });
  assert.deepEqual(result, [2, 4, 6, 8, 10]);
  assert.equal(peak, 2);
});
