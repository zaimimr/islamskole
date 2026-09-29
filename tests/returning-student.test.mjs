import assert from "node:assert/strict";
import test from "node:test";
import { planPaymentTargets } from "../src/lib/families/returning-student.ts";

const total = (existing, planned) =>
  [...existing, ...planned].reduce((sum, row) => sum + row.amount, 0);

test("targets never exceed the payment amount", () => {
  const existing = [{ studentId: "a", amount: 300000 }];
  const planned = planPaymentTargets(
    existing,
    [
      { studentId: "b", share: 300000 },
      { studentId: "c", share: 300000 },
    ],
    500000,
  );
  assert.deepEqual(planned, [{ studentId: "b", amount: 200000 }]);
  assert.ok(total(existing, planned) <= 500000);
});

test("existing targets keep their amounts and are not added twice", () => {
  const existing = [{ studentId: "a", amount: 100000 }];
  const planned = planPaymentTargets(
    existing,
    [
      { studentId: "a", share: 900000 },
      { studentId: "b", share: 150000 },
    ],
    600000,
  );
  assert.deepEqual(planned, [{ studentId: "b", amount: 150000 }]);
});

test("nothing is planned when the payment is already fully targeted", () => {
  const planned = planPaymentTargets(
    [{ studentId: "a", amount: 500000 }],
    [{ studentId: "b", share: 300000 }],
    500000,
  );
  assert.deepEqual(planned, []);
});
