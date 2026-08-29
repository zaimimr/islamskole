export type PlanType = "full" | "semester" | "maanedlig";

export const SEMESTER_INSTALLMENT_ORE = 150000;

export type InstallmentSlot = {
  dueDate: string;
  amount: number;
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function clampToDate(dueDate: string, floor: string): string {
  return dueDate < floor ? floor : dueDate;
}

export function layoutSemesterSlots(
  remaining: number,
  sem1DueOn: string | null,
  sem2DueOn: string | null,
  today: string = isoDate(new Date()),
): InstallmentSlot[] {
  if (remaining <= 0) return [];
  const sem1 = sem1DueOn ?? today;
  const sem2 = sem2DueOn ?? sem1;

  const slots: InstallmentSlot[] = [];
  const upfront = Math.max(remaining - 2 * SEMESTER_INSTALLMENT_ORE, 0);
  if (upfront > 0) slots.push({ dueDate: today, amount: upfront });

  const first = Math.min(SEMESTER_INSTALLMENT_ORE, remaining - upfront);
  if (first > 0) slots.push({ dueDate: clampToDate(sem1, today), amount: first });

  const second = remaining - upfront - first;
  if (second > 0) {
    slots.push({ dueDate: clampToDate(sem2, today), amount: second });
  }

  return slots;
}

export function layoutMonthlySlots(
  remaining: number,
  monthlyAmount: number,
  dueDay: number,
  from: Date = new Date(),
): InstallmentSlot[] {
  if (remaining <= 0 || monthlyAmount <= 0) return [];

  const slots: InstallmentSlot[] = [];
  let left = remaining;
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), dueDay),
  );
  if (isoDate(cursor) <= isoDate(from)) {
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  for (let i = 0; i < 24 && left > 0; i += 1) {
    const amount = Math.min(monthlyAmount, left);
    slots.push({ dueDate: isoDate(cursor), amount });
    left -= amount;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  if (left > 0 && slots.length > 0) {
    slots[slots.length - 1].amount += left;
  }

  return slots;
}

export function layoutSlots(
  planType: PlanType,
  remaining: number,
  year: {
    sem1DueOn: string | null;
    sem2DueOn: string | null;
    monthlyDueDay: number;
  },
  monthlyAmount: number | null,
  today: string = isoDate(new Date()),
): InstallmentSlot[] {
  if (remaining <= 0) return [];
  if (planType === "full") {
    return [{ dueDate: today, amount: remaining }];
  }
  if (planType === "semester") {
    return layoutSemesterSlots(remaining, year.sem1DueOn, year.sem2DueOn, today);
  }
  return layoutMonthlySlots(remaining, monthlyAmount ?? 0, year.monthlyDueDay);
}
