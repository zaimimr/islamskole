import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCustomConfig,
  computeCustomSchedule,
  layoutCustomPlan,
  monthDates,
} from "../src/lib/custom-payment-plan.ts";

const BASE = {
  initial_amount: null,
  initial_mode: "totalt",
  initial_due_date: null,
  monthly_amount: null,
  monthly_mode: "totalt",
  final_amount: null,
  final_mode: "totalt",
  final_due_date: null,
  start_month: "2026-10",
  end_month: "2027-03",
  due_day: 15,
};

function sumRows(rows) {
  return rows.reduce((sum, row) => sum + row.total, 0);
}

function childSum(rows, studentId) {
  return rows.reduce(
    (sum, row) =>
      sum +
      (row.perChild.find((part) => part.studentId === studentId)?.amount ?? 0),
    0,
  );
}

test("month dates cover the range on the due day", () => {
  assert.deepEqual(monthDates("2026-11", "2027-02", 10), [
    "2026-11-10",
    "2026-12-10",
    "2027-01-10",
    "2027-02-10",
  ]);
});

test("total mode computes monthly from initial and final", () => {
  const result = computeCustomSchedule(
    {
      ...BASE,
      initial_amount: 200000,
      initial_due_date: "2026-10-01",
      final_amount: 100000,
      final_due_date: "2027-04-15",
    },
    [{ studentId: "a", amount: 900000 }],
  );
  assert.equal(result.ok, true);
  assert.equal(result.monthlyTotal, 100000);
  assert.deepEqual(
    result.rows.map((row) => [row.dueDate, row.kind, row.total]),
    [
      ["2026-10-01", "forste", 200000],
      ["2026-10-15", "maanedlig", 100000],
      ["2026-11-15", "maanedlig", 100000],
      ["2026-12-15", "maanedlig", 100000],
      ["2027-01-15", "maanedlig", 100000],
      ["2027-02-15", "maanedlig", 100000],
      ["2027-03-15", "maanedlig", 100000],
      ["2027-04-15", "siste", 100000],
    ],
  );
  assert.equal(sumRows(result.rows), 900000);
});

test("per child mode multiplies by number of children", () => {
  const result = computeCustomSchedule(
    {
      ...BASE,
      initial_amount: 100000,
      initial_mode: "per_barn",
      initial_due_date: "2026-10-01",
      monthly_amount: 50000,
      monthly_mode: "per_barn",
      final_due_date: "2027-04-15",
    },
    [
      { studentId: "a", amount: 500000 },
      { studentId: "b", amount: 500000 },
    ],
  );
  assert.equal(result.ok, true);
  assert.equal(result.rows[0].total, 200000);
  assert.deepEqual(result.rows[0].perChild, [
    { studentId: "a", amount: 100000 },
    { studentId: "b", amount: 100000 },
  ]);
  assert.equal(result.rows[1].total, 100000);
  const last = result.rows.at(-1);
  assert.equal(last.kind, "siste");
  assert.equal(last.total, 1000000 - 200000 - 6 * 100000);
  assert.equal(sumRows(result.rows), 1000000);
});

test("rounding remainder goes to the final installment", () => {
  const result = computeCustomSchedule(
    { ...BASE, start_month: "2026-10", end_month: "2026-12" },
    [{ studentId: "a", amount: 1000050 }],
  );
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.rows.map((row) => [row.kind, row.total]),
    [
      ["maanedlig", 333300],
      ["maanedlig", 333300],
      ["siste", 333450],
    ],
  );
  for (const row of result.rows.slice(0, -1)) {
    assert.equal(row.total % 100, 0);
  }
  assert.equal(sumRows(result.rows), 1000050);
});

test("uneven child balances split proportionally and add up per child", () => {
  const targets = [
    { studentId: "a", amount: 500000 },
    { studentId: "b", amount: 250000 },
    { studentId: "c", amount: 175000 },
  ];
  const result = computeCustomSchedule(
    {
      ...BASE,
      initial_amount: 100000,
      initial_due_date: "2026-10-01",
      final_due_date: "2027-04-01",
    },
    targets,
  );
  assert.equal(result.ok, true);
  for (const target of targets) {
    assert.equal(childSum(result.rows, target.studentId), target.amount);
  }
  for (const row of result.rows) {
    assert.equal(
      row.total,
      row.perChild.reduce((sum, part) => sum + part.amount, 0),
    );
    for (const part of row.perChild) {
      assert.ok(part.amount >= 0);
      if (row.kind !== "siste") assert.equal(part.amount % 100, 0);
    }
  }
  const first = result.rows[0].perChild;
  assert.ok(first[0].amount > first[1].amount);
  assert.ok(first[1].amount > first[2].amount);
  assert.equal(sumRows(result.rows), 925000);
});

test("single month without final date puts everything in one installment", () => {
  const result = computeCustomSchedule(
    { ...BASE, start_month: "2026-11", end_month: "2026-11" },
    [
      { studentId: "a", amount: 300000 },
      { studentId: "b", amount: 100050 },
    ],
  );
  assert.equal(result.ok, true);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].dueDate, "2026-11-15");
  assert.equal(result.rows[0].total, 400050);
  assert.deepEqual(result.rows[0].perChild, [
    { studentId: "a", amount: 300000 },
    { studentId: "b", amount: 100050 },
  ]);
});

test("given monthly makes the final payment the remainder", () => {
  const result = computeCustomSchedule(
    {
      ...BASE,
      monthly_amount: 100000,
      final_due_date: "2027-05-01",
    },
    [{ studentId: "a", amount: 750000 }],
  );
  assert.equal(result.ok, true);
  assert.equal(result.rows.at(-1).kind, "siste");
  assert.equal(result.rows.at(-1).total, 150000);
});

test("validation rejects bad input", () => {
  const targets = [{ studentId: "a", amount: 500000 }];
  assert.equal(
    computeCustomSchedule(
      { ...BASE, start_month: "2027-03", end_month: "2026-10" },
      targets,
    ).ok,
    false,
  );
  assert.equal(
    computeCustomSchedule({ ...BASE, monthly_amount: 200000 }, targets).ok,
    false,
  );
  assert.equal(
    computeCustomSchedule({ ...BASE, initial_amount: -100 }, targets).ok,
    false,
  );
  assert.equal(
    computeCustomSchedule(
      { ...BASE, initial_amount: 600000, initial_due_date: "2026-10-01" },
      targets,
    ).ok,
    false,
  );
  assert.equal(computeCustomSchedule(BASE, []).ok, false);
  assert.equal(
    buildCustomConfig({ initial_amount_nok: "-5" }).ok,
    false,
  );
  assert.equal(buildCustomConfig({ initial_amount_nok: "10.5" }).ok, false);
});

test("form fields become a config in øre", () => {
  const result = buildCustomConfig({
    initial_amount_nok: "2 000",
    initial_mode: "per_barn",
    initial_due_date: "2026-10-01",
    monthly_amount_nok: "500",
    final_amount_nok: "999",
    start_month: "2026-10",
    end_month: "2027-03",
    due_day: "20",
  });
  assert.equal(result.ok, true);
  assert.equal(result.config.initial_amount, 200000);
  assert.equal(result.config.initial_mode, "per_barn");
  assert.equal(result.config.monthly_amount, 50000);
  assert.equal(result.config.final_amount, null);
  assert.equal(result.config.due_day, 20);
});

test("regeneration skips consumed dates and spreads what is left", () => {
  const config = {
    ...BASE,
    initial_amount: 200000,
    initial_due_date: "2026-10-01",
    start_month: "2026-11",
    end_month: "2027-02",
  };
  const slots = layoutCustomPlan(
    config,
    [{ studentId: "a", amount: 400000 }],
    ["2026-10-01", "2026-11-15"],
    "2026-11-20",
  );
  assert.deepEqual(slots, [
    { studentId: "a", dueDate: "2026-12-15", amount: 133300 },
    { studentId: "a", dueDate: "2027-01-15", amount: 133300 },
    { studentId: "a", dueDate: "2027-02-15", amount: 133400 },
  ]);
});

test("regeneration falls back when fixed amounts exceed what is owed", () => {
  const slots = layoutCustomPlan(
    {
      ...BASE,
      start_month: "2026-11",
      end_month: "2026-12",
      monthly_amount: 300000,
    },
    [{ studentId: "a", amount: 200000 }],
    [],
    "2026-10-01",
  );
  assert.deepEqual(slots, [
    { studentId: "a", dueDate: "2026-11-15", amount: 100000 },
    { studentId: "a", dueDate: "2026-12-15", amount: 100000 },
  ]);
});
