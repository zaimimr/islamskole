"use client";

import { useEffect, useState } from "react";
import {
  buildCustomConfig,
  computeCustomSchedule,
  type CustomPlanConfig,
  type CustomPlanFields,
  type CustomSlotKind,
} from "@/lib/custom-payment-plan";
import { formatNok } from "@/lib/money";
import { formatOsloDate, osloToday } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";

export type CustomPlanChild = {
  id: string;
  name: string;
  remainingOre: number;
};

const kindLabels: Record<CustomSlotKind, string> = {
  forste: "Første betaling",
  maanedlig: "Månedlig",
  siste: "Siste betaling",
};

const modeOptions = [
  { value: "totalt", label: "Totalt" },
  { value: "per_barn", label: "Per barn" },
];

function shiftMonth(month: string, offset: number) {
  const [year, m] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + offset;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

function defaultEndMonth(start: string) {
  const [year, month] = start.split("-").map(Number);
  return `${month >= 7 ? year + 1 : year}-06`;
}

function monthLabel(month: string) {
  return formatOsloDate(`${month}-15`, { month: "long", year: "numeric" });
}

function toKroner(ore: number | null | undefined) {
  return ore ? String(ore / 100) : "";
}

function initialFields(config: CustomPlanConfig | null): CustomPlanFields {
  if (config) {
    return {
      initial_amount_nok: toKroner(config.initial_amount),
      initial_mode: config.initial_mode,
      initial_due_date: config.initial_due_date ?? "",
      monthly_amount_nok: toKroner(config.monthly_amount),
      monthly_mode: config.monthly_mode,
      final_amount_nok: toKroner(config.final_amount),
      final_mode: config.final_mode,
      final_due_date: config.final_due_date ?? "",
      start_month: config.start_month,
      end_month: config.end_month,
      due_day: String(config.due_day),
    };
  }
  const start = shiftMonth(osloToday().slice(0, 7), 1);
  return {
    initial_mode: "totalt",
    monthly_mode: "totalt",
    final_mode: "totalt",
    start_month: start,
    end_month: defaultEndMonth(start),
    due_day: "15",
  };
}

export function CustomPlanBuilder({
  familyChildren,
  config,
  onValidChange,
}: {
  familyChildren: CustomPlanChild[];
  config: CustomPlanConfig | null;
  onValidChange: (valid: boolean) => void;
}) {
  const [fields, setFields] = useState<CustomPlanFields>(() =>
    initialFields(config),
  );
  const set = (key: keyof CustomPlanFields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const payingChildren = familyChildren.filter(
    (child) => child.remainingOre > 0,
  );
  const familyRemaining = payingChildren.reduce(
    (sum, child) => sum + child.remainingOre,
    0,
  );
  const nameById = new Map(
    familyChildren.map((child) => [child.id, child.name]),
  );

  const built = buildCustomConfig(fields);
  const result = built.ok
    ? computeCustomSchedule(
        built.config,
        payingChildren.map((child) => ({
          studentId: child.id,
          amount: child.remainingOre,
        })),
      )
    : built;

  useEffect(() => {
    onValidChange(result.ok);
  }, [result.ok, onValidChange]);

  const today = osloToday().slice(0, 7);
  const monthOptions = Array.from({ length: 25 }, (_, index) =>
    shiftMonth(today, index - 6),
  );
  for (const month of [fields.start_month, fields.end_month]) {
    if (month && !monthOptions.includes(month)) monthOptions.unshift(month);
  }
  const monthSelect = monthOptions.map((month) => ({
    value: month,
    label: monthLabel(month),
  }));
  const monthlyGiven = Boolean(fields.monthly_amount_nok?.trim());
  const finalRow = result.ok
    ? result.rows.find((row) => row.kind === "siste")
    : undefined;

  return (
    <div className="grid gap-4 rounded-xl bg-[#FAF9F5] p-3 ring-1 ring-[#E8E3D9]">
      <p className="text-sm text-admin-muted">
        Familien har igjen{" "}
        <span className="font-bold text-foreground">
          {formatNok(familyRemaining)}
        </span>{" "}
        for {payingChildren.length} barn. Fyll inn det du vil
        bestemme selv, resten regnes ut. Beløp i hele kroner.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="start_month">Første måned</Label>
          <SelectField
            id="start_month"
            name="start_month"
            value={fields.start_month}
            onValueChange={set("start_month")}
            options={monthSelect}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="end_month">Siste måned</Label>
          <SelectField
            id="end_month"
            name="end_month"
            value={fields.end_month}
            onValueChange={set("end_month")}
            options={monthSelect}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="due_day">Forfallsdag i måneden</Label>
          <Input
            id="due_day"
            name="due_day"
            type="number"
            min={1}
            max={28}
            value={fields.due_day ?? ""}
            onChange={(event) => set("due_day")(event.target.value)}
          />
        </div>
      </div>

      <AmountRow
        title="Første betaling"
        amountName="initial_amount_nok"
        amount={fields.initial_amount_nok ?? ""}
        onAmount={set("initial_amount_nok")}
        modeName="initial_mode"
        mode={fields.initial_mode ?? "totalt"}
        onMode={set("initial_mode")}
        dateName="initial_due_date"
        date={fields.initial_due_date ?? ""}
        onDate={set("initial_due_date")}
        placeholder="Ingen"
      />
      <AmountRow
        title="Månedlig avdrag"
        amountName="custom_monthly_amount_nok"
        amount={fields.monthly_amount_nok ?? ""}
        onAmount={set("monthly_amount_nok")}
        modeName="monthly_mode"
        mode={fields.monthly_mode ?? "totalt"}
        onMode={set("monthly_mode")}
        placeholder={
          result.ok && !monthlyGiven
            ? `Regnes ut: ${formatNok(result.monthlyTotal)} totalt`
            : "Regnes ut"
        }
      />
      <AmountRow
        title="Siste betaling"
        amountName="final_amount_nok"
        amount={monthlyGiven ? "" : (fields.final_amount_nok ?? "")}
        onAmount={set("final_amount_nok")}
        modeName="final_mode"
        mode={fields.final_mode ?? "totalt"}
        onMode={set("final_mode")}
        dateName="final_due_date"
        date={fields.final_due_date ?? ""}
        onDate={set("final_due_date")}
        disabled={monthlyGiven}
        placeholder={
          monthlyGiven
            ? finalRow
              ? `Resten: ${formatNok(finalRow.total)}`
              : "Resten"
            : "Resten"
        }
      />

      {result.ok ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold tracking-[0.04em] uppercase text-admin-muted">
                <th className="py-1.5 pr-3">Frist</th>
                <th className="py-1.5 pr-3">Type</th>
                {payingChildren.map((child) => (
                  <th key={child.id} className="py-1.5 pr-3 text-right">
                    {child.name}
                  </th>
                ))}
                <th className="py-1.5 text-right">Sum</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr
                  key={`${row.dueDate}-${row.kind}`}
                  className="border-t border-[#ECE8DF]"
                >
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {formatOsloDate(row.dueDate, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-1.5 pr-3 text-admin-muted">
                    {kindLabels[row.kind]}
                  </td>
                  {row.perChild.map((part) => (
                    <td
                      key={part.studentId}
                      className="py-1.5 pr-3 text-right tabular-nums"
                      aria-label={nameById.get(part.studentId)}
                    >
                      {formatNok(part.amount)}
                    </td>
                  ))}
                  <td className="py-1.5 text-right font-bold tabular-nums">
                    {formatNok(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#E3DED3] font-bold">
                <td className="py-1.5 pr-3" colSpan={2}>
                  {result.rows.length} betalinger
                </td>
                {payingChildren.map((child) => (
                  <td key={child.id} className="py-1.5 pr-3 text-right tabular-nums">
                    {formatNok(child.remainingOre)}
                  </td>
                ))}
                <td className="py-1.5 text-right tabular-nums">
                  {formatNok(result.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p role="alert" className="text-sm font-bold text-[#8B2F2B]">
          {result.error}
        </p>
      )}
    </div>
  );
}

function AmountRow({
  title,
  amountName,
  amount,
  onAmount,
  modeName,
  mode,
  onMode,
  dateName,
  date,
  onDate,
  disabled,
  placeholder,
}: {
  title: string;
  amountName: string;
  amount: string;
  onAmount: (value: string) => void;
  modeName: string;
  mode: string;
  onMode: (value: string) => void;
  dateName?: string;
  date?: string;
  onDate?: (value: string) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-bold">{title}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          name={amountName}
          inputMode="numeric"
          aria-label={`${title}, kroner`}
          value={amount}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onAmount(event.target.value)}
        />
        <SelectField
          name={modeName}
          aria-label={`${title}, totalt eller per barn`}
          value={mode}
          onValueChange={onMode}
          options={modeOptions}
        />
        {dateName && onDate ? (
          <Input
            name={dateName}
            type="date"
            aria-label={`${title}, frist`}
            value={date}
            onChange={(event) => onDate(event.target.value)}
          />
        ) : null}
      </div>
    </fieldset>
  );
}
