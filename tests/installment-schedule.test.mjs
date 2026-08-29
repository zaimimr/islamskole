import assert from "node:assert/strict";
import test from "node:test";
import {
  layoutMonthlySlots,
  layoutSemesterSlots,
  layoutSlots,
} from "../src/lib/installment-schedule.ts";

const YEAR = {
  sem1DueOn: "2026-08-15",
  sem2DueOn: "2026-12-15",
  monthlyDueDay: 15,
};

test("semester plan after 2000 deposit becomes 1500 + 1500", () => {
  const slots = layoutSemesterSlots(300000, "2026-08-15", "2026-12-15", "2026-07-01");
  assert.deepEqual(slots, [
    { dueDate: "2026-08-15", amount: 150000 },
    { dueDate: "2026-12-15", amount: 150000 },
  ]);
});

test("semester plan without deposit adds upfront slot", () => {
  const slots = layoutSemesterSlots(500000, "2026-08-15", "2026-12-15", "2026-07-01");
  assert.deepEqual(slots, [
    { dueDate: "2026-07-01", amount: 200000 },
    { dueDate: "2026-08-15", amount: 150000 },
    { dueDate: "2026-12-15", amount: 150000 },
  ]);
  assert.equal(
    slots.reduce((sum, slot) => sum + slot.amount, 0),
    500000,
  );
});

test("semester plan with sibling discount drops the second slot", () => {
  const slots = layoutSemesterSlots(150000, "2026-08-15", "2026-12-15", "2026-07-01");
  assert.deepEqual(slots, [{ dueDate: "2026-08-15", amount: 150000 }]);
});

test("past semester deadlines clamp to today", () => {
  const slots = layoutSemesterSlots(300000, "2026-08-15", "2026-12-15", "2026-09-01");
  assert.equal(slots[0].dueDate, "2026-09-01");
  assert.equal(slots[1].dueDate, "2026-12-15");
});

test("monthly plan lays out fixed amounts with remainder on the last slot", () => {
  const slots = layoutMonthlySlots(250000, 100000, 15, new Date("2026-08-01T12:00:00Z"));
  assert.deepEqual(slots, [
    { dueDate: "2026-08-15", amount: 100000 },
    { dueDate: "2026-09-15", amount: 100000 },
    { dueDate: "2026-10-15", amount: 50000 },
  ]);
});

test("monthly plan starts next month when due day has passed", () => {
  const slots = layoutMonthlySlots(100000, 50000, 15, new Date("2026-08-20T12:00:00Z"));
  assert.equal(slots[0].dueDate, "2026-09-15");
  assert.equal(slots[1].dueDate, "2026-10-15");
});

test("full plan is a single slot due today", () => {
  const slots = layoutSlots("full", 300000, YEAR, null, "2026-07-01");
  assert.deepEqual(slots, [{ dueDate: "2026-07-01", amount: 300000 }]);
});

test("zero remaining produces no slots", () => {
  assert.deepEqual(layoutSlots("semester", 0, YEAR, null, "2026-07-01"), []);
  assert.deepEqual(layoutMonthlySlots(0, 100000, 15), []);
});
