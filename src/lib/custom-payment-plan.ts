export type AmountMode = "per_barn" | "totalt";

export type CustomPlanConfig = {
  initial_amount: number | null;
  initial_mode: AmountMode;
  initial_due_date: string | null;
  monthly_amount: number | null;
  monthly_mode: AmountMode;
  final_amount: number | null;
  final_mode: AmountMode;
  final_due_date: string | null;
  start_month: string;
  end_month: string;
  due_day: number;
};

export type ChildTarget = { studentId: string; amount: number };

export type CustomSlotKind = "forste" | "maanedlig" | "siste";

export type CustomScheduleRow = {
  dueDate: string;
  kind: CustomSlotKind;
  total: number;
  perChild: ChildTarget[];
};

export type CustomScheduleResult =
  | { ok: true; rows: CustomScheduleRow[]; total: number; monthlyTotal: number }
  | { ok: false; error: string };

export type CustomInstallmentSlot = {
  studentId: string;
  dueDate: string;
  amount: number;
};

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function monthDates(
  startMonth: string,
  endMonth: string,
  dueDay: number,
): string[] {
  if (!monthPattern.test(startMonth) || !monthPattern.test(endMonth)) return [];
  const [startYear, startM] = startMonth.split("-").map(Number);
  const [endYear, endM] = endMonth.split("-").map(Number);
  const dates: string[] = [];
  let year = startYear;
  let month = startM;
  while (year * 12 + month <= endYear * 12 + endM && dates.length < 60) {
    dates.push(`${year}-${pad(month)}-${pad(dueDay)}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return dates;
}

function shareOf(slotTotal: number, target: number, total: number) {
  return Math.floor((slotTotal * target) / (total * 100)) * 100;
}

function isNegative(value: number | null) {
  return value != null && (!Number.isFinite(value) || value < 0);
}

export function computeCustomSchedule(
  config: CustomPlanConfig,
  targets: ChildTarget[],
  options: { skipDates?: string[] } = {},
): CustomScheduleResult {
  if (
    !monthPattern.test(config.start_month) ||
    !monthPattern.test(config.end_month)
  ) {
    return { ok: false, error: "Velg start- og sluttmåned" };
  }
  if (config.end_month < config.start_month) {
    return { ok: false, error: "Sluttmåned må være etter startmåned" };
  }
  if (
    !Number.isInteger(config.due_day) ||
    config.due_day < 1 ||
    config.due_day > 28
  ) {
    return { ok: false, error: "Forfallsdag må være mellom 1 og 28" };
  }
  if (
    isNegative(config.initial_amount) ||
    isNegative(config.monthly_amount) ||
    isNegative(config.final_amount)
  ) {
    return { ok: false, error: "Beløp kan ikke være negative" };
  }
  if (config.initial_amount && !datePattern.test(config.initial_due_date ?? "")) {
    return { ok: false, error: "Velg dato for første betaling" };
  }
  if (
    config.final_amount &&
    !config.monthly_amount &&
    !datePattern.test(config.final_due_date ?? "")
  ) {
    return { ok: false, error: "Velg dato for siste betaling" };
  }

  const children = targets.filter((target) => target.amount > 0);
  const total = children.reduce((sum, child) => sum + child.amount, 0);
  if (total <= 0) {
    return { ok: false, error: "Familien har ingenting igjen å betale" };
  }

  const skip = new Set(options.skipDates ?? []);
  const scale = (amount: number | null, mode: AmountMode) =>
    amount ? (mode === "per_barn" ? amount * children.length : amount) : 0;

  const initialDate =
    config.initial_amount &&
    config.initial_due_date &&
    !skip.has(config.initial_due_date)
      ? config.initial_due_date
      : null;
  const finalDate =
    config.final_due_date &&
    datePattern.test(config.final_due_date) &&
    !skip.has(config.final_due_date)
      ? config.final_due_date
      : null;
  const months = monthDates(
    config.start_month,
    config.end_month,
    config.due_day,
  ).filter((date) => !skip.has(date));

  const initialTotal = initialDate
    ? scale(config.initial_amount, config.initial_mode)
    : 0;

  let monthlyTotal: number;
  if (config.monthly_amount) {
    monthlyTotal = scale(config.monthly_amount, config.monthly_mode);
    if (total - initialTotal - monthlyTotal * months.length < 0) {
      return { ok: false, error: "Avdragene blir mer enn familien skylder" };
    }
  } else {
    const fixedFinal = finalDate
      ? scale(config.final_amount, config.final_mode)
      : 0;
    const available = total - initialTotal - fixedFinal;
    if (available < 0) {
      return {
        ok: false,
        error: "Første og siste betaling er mer enn familien skylder",
      };
    }
    monthlyTotal =
      months.length > 0
        ? Math.floor(available / months.length / 100) * 100
        : 0;
  }

  const lastMonth = months[months.length - 1];
  if (finalDate && lastMonth && finalDate < lastMonth) {
    return {
      ok: false,
      error: "Siste betaling må være etter siste månedlige avdrag",
    };
  }
  if (finalDate && initialDate && finalDate < initialDate) {
    return { ok: false, error: "Siste betaling må være etter første betaling" };
  }

  const slots: { dueDate: string; kind: CustomSlotKind; total: number }[] = [];
  if (initialDate && initialTotal > 0) {
    slots.push({ dueDate: initialDate, kind: "forste", total: initialTotal });
  }
  if (monthlyTotal > 0) {
    for (const date of months) {
      slots.push({ dueDate: date, kind: "maanedlig", total: monthlyTotal });
    }
  }

  const allocated = new Map(children.map((child) => [child.studentId, 0]));
  const rows: CustomScheduleRow[] = slots
    .map((slot, index) => ({ slot, index }))
    .sort((a, b) =>
      a.slot.dueDate === b.slot.dueDate
        ? a.index - b.index
        : a.slot.dueDate < b.slot.dueDate
          ? -1
          : 1,
    )
    .map(({ slot }) => {
      const perChild = children.map((child) => {
        const amount = shareOf(slot.total, child.amount, total);
        allocated.set(
          child.studentId,
          (allocated.get(child.studentId) ?? 0) + amount,
        );
        return { studentId: child.studentId, amount };
      });
      return {
        dueDate: slot.dueDate,
        kind: slot.kind,
        total: perChild.reduce((sum, part) => sum + part.amount, 0),
        perChild,
      };
    });

  const leftover = children.map((child) => ({
    studentId: child.studentId,
    amount: child.amount - (allocated.get(child.studentId) ?? 0),
  }));
  const leftoverTotal = leftover.reduce((sum, part) => sum + part.amount, 0);

  if (leftoverTotal > 0) {
    if (finalDate) {
      rows.push({
        dueDate: finalDate,
        kind: "siste",
        total: leftoverTotal,
        perChild: leftover,
      });
    } else {
      const last = rows[rows.length - 1];
      if (!last) {
        return {
          ok: false,
          error: "Velg en periode eller en dato for siste betaling",
        };
      }
      last.kind = "siste";
      last.total += leftoverTotal;
      last.perChild = last.perChild.map((part, index) => ({
        studentId: part.studentId,
        amount: part.amount + leftover[index].amount,
      }));
    }
  }

  return { ok: true, rows, total, monthlyTotal };
}

export function flattenSchedule(
  rows: CustomScheduleRow[],
): CustomInstallmentSlot[] {
  return rows.flatMap((row) =>
    row.perChild
      .filter((part) => part.amount > 0)
      .map((part) => ({
        studentId: part.studentId,
        dueDate: row.dueDate,
        amount: part.amount,
      })),
  );
}

export function layoutCustomPlan(
  config: CustomPlanConfig,
  targets: ChildTarget[],
  skipDates: string[],
  today: string,
): CustomInstallmentSlot[] {
  const strict = computeCustomSchedule(config, targets, { skipDates });
  if (strict.ok) return flattenSchedule(strict.rows);

  const relaxed = computeCustomSchedule(
    {
      ...config,
      initial_amount: null,
      monthly_amount: null,
      final_amount: null,
    },
    targets,
    { skipDates },
  );
  if (relaxed.ok) return flattenSchedule(relaxed.rows);

  const lastPlanned =
    config.final_due_date ??
    monthDates(config.start_month, config.end_month, config.due_day).at(-1) ??
    today;
  const dueDate = lastPlanned > today ? lastPlanned : today;
  return targets
    .filter((target) => target.amount > 0)
    .map((target) => ({
      studentId: target.studentId,
      dueDate,
      amount: target.amount,
    }));
}

export type CustomPlanFields = Partial<
  Record<
    | "initial_amount_nok"
    | "initial_mode"
    | "initial_due_date"
    | "monthly_amount_nok"
    | "monthly_mode"
    | "final_amount_nok"
    | "final_mode"
    | "final_due_date"
    | "start_month"
    | "end_month"
    | "due_day",
    string
  >
>;

function parseKroner(value: string | undefined): number | null | "invalid" {
  const trimmed = (value ?? "").replace(/\s/g, "").replace(",", ".");
  if (!trimmed) return null;
  const kroner = Number(trimmed);
  if (!Number.isFinite(kroner) || kroner < 0 || !Number.isInteger(kroner)) {
    return "invalid";
  }
  return kroner === 0 ? null : kroner * 100;
}

function parseMode(value: string | undefined): AmountMode {
  return value === "per_barn" ? "per_barn" : "totalt";
}

export function buildCustomConfig(
  fields: CustomPlanFields,
): { ok: true; config: CustomPlanConfig } | { ok: false; error: string } {
  const initial = parseKroner(fields.initial_amount_nok);
  const monthly = parseKroner(fields.monthly_amount_nok);
  const final = parseKroner(fields.final_amount_nok);
  if (initial === "invalid" || monthly === "invalid" || final === "invalid") {
    return { ok: false, error: "Beløp må være hele kroner og ikke negative" };
  }
  return {
    ok: true,
    config: {
      initial_amount: initial,
      initial_mode: parseMode(fields.initial_mode),
      initial_due_date: fields.initial_due_date?.trim() || null,
      monthly_amount: monthly,
      monthly_mode: parseMode(fields.monthly_mode),
      final_amount: monthly ? null : final,
      final_mode: parseMode(fields.final_mode),
      final_due_date: fields.final_due_date?.trim() || null,
      start_month: fields.start_month?.trim() ?? "",
      end_month: fields.end_month?.trim() ?? "",
      due_day: Number(fields.due_day || 15),
    },
  };
}
