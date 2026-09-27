"use client";

import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, CheckCheck, Clock, Loader2, MessageSquareText, Phone, X } from "lucide-react";
import { markAttendance, markAttendanceMany } from "@/lib/portal/actions";
import type { AttendanceStatus, PortalRosterRow } from "@/lib/portal/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MarkStatus = Exclude<AttendanceStatus, "meldt_fravaer">;
type StatusMap = Record<string, AttendanceStatus | null>;

const MARK_OPTIONS: { status: MarkStatus; icon: typeof Check; active: string }[] = [
  { status: "til_stede", icon: Check, active: "bg-admin-action text-white ring-admin-action" },
  {
    status: "fravaer",
    icon: X,
    active: "bg-[color-mix(in_oklch,var(--destructive),black_18%)] text-white ring-transparent",
  },
  { status: "sent", icon: Clock, active: "bg-brand-sun text-foreground ring-[color-mix(in_oklch,var(--brand-sun),black_20%)]" },
];

function fullName(row: { first_name: string | null; last_name: string | null }) {
  return [row.first_name, row.last_name].filter(Boolean).join(" ");
}

export function AttendanceRoster({
  rows,
  schoolDayId,
  markable,
}: {
  rows: PortalRosterRow[];
  schoolDayId: string;
  markable: boolean;
}) {
  const t = useTranslations("portal.teacher");
  const tErrors = useTranslations("portal.errors");
  const [pending, startTransition] = useTransition();
  const base: StatusMap = Object.fromEntries(rows.map((row) => [row.student_id, row.attendance_status]));
  const [statuses, applyStatuses] = useOptimistic(base, (state: StatusMap, update: StatusMap) => ({
    ...state,
    ...update,
  }));

  const counts = { til_stede: 0, fravaer: 0, sent: 0, unmarked: 0 };
  for (const row of rows) {
    const status = statuses[row.student_id];
    if (!status) counts.unmarked += 1;
    else if (status === "meldt_fravaer") counts.fravaer += 1;
    else counts[status] += 1;
  }
  const unmarkedIds = rows.filter((row) => !statuses[row.student_id]).map((row) => row.student_id);

  function mark(studentIds: string[], status: MarkStatus) {
    startTransition(async () => {
      applyStatuses(Object.fromEntries(studentIds.map((id) => [id, status])));
      const result =
        studentIds.length === 1
          ? await markAttendance(studentIds[0], schoolDayId, status)
          : await markAttendanceMany(studentIds, schoolDayId, status);
      if (!result.ok) toast.error(tErrors(result.error));
    });
  }

  if (!rows.length) {
    return <p className="rounded-2xl bg-card p-5 text-muted-foreground ring-1 ring-foreground/8">{t("roster.empty")}</p>;
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ul className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
          <SummaryItem dot="bg-admin-action" value={counts.til_stede} label={t("summary.present")} />
          <SummaryItem dot="bg-destructive" value={counts.fravaer} label={t("summary.absent")} />
          <SummaryItem dot="bg-brand-sun" value={counts.sent} label={t("summary.late")} />
          <SummaryItem dot="bg-foreground/25" value={counts.unmarked} label={t("summary.unmarked")} />
        </ul>
        {markable && unmarkedIds.length ? (
          <Button type="button" variant="secondary" onClick={() => mark(unmarkedIds, "til_stede")} disabled={pending}>
            {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <CheckCheck aria-hidden="true" />}
            {unmarkedIds.length === rows.length
              ? t("roster.allPresent")
              : t("roster.restPresent", { count: unmarkedIds.length })}
          </Button>
        ) : null}
      </div>

      <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/8">
        {rows.map((row) => {
          const name = fullName(row);
          const status = statuses[row.student_id];
          const reported = row.absence_report_id !== null || status === "meldt_fravaer";
          return (
            <li key={row.student_id} className="grid gap-3 p-4">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-lg font-bold">{name}</p>
                {row.age !== null ? (
                  <p className="text-sm text-muted-foreground">{t("roster.age", { age: row.age })}</p>
                ) : null}
              </div>

              {reported ? (
                <p className="flex items-start gap-2 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
                  <MessageSquareText aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <span className="font-semibold">{t("status.meldt_fravaer")}</span>
                    {row.absence_reason ? `: ${row.absence_reason}` : null}
                  </span>
                </p>
              ) : null}

              <div role="group" aria-label={t("roster.statusGroup", { name })} className="grid grid-cols-3 gap-2">
                {MARK_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = status === option.status;
                  return (
                    <button
                      key={option.status}
                      type="button"
                      aria-pressed={selected}
                      disabled={!markable}
                      onClick={() => {
                        if (!selected) mark([row.student_id], option.status);
                      }}
                      className={cn(
                        "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-bold ring-1 transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                        selected ? option.active : "bg-background text-foreground ring-foreground/12 hover:bg-muted",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      {t(`status.${option.status}`)}
                    </button>
                  );
                })}
              </div>

              {row.guardians.some((guardian) => guardian.phone) ? (
                <ul className="flex flex-wrap gap-2">
                  {row.guardians
                    .filter((guardian) => guardian.phone)
                    .map((guardian) => {
                      const guardianName = fullName(guardian) || guardian.phone;
                      return (
                        <li key={`${guardianName}-${guardian.phone}`}>
                          <a
                            href={`tel:${guardian.phone!.replace(/[^\d+]/g, "")}`}
                            aria-label={t("roster.call", { name: guardianName ?? "" })}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-green-dark ring-1 ring-foreground/10 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            <Phone aria-hidden="true" className="size-4 shrink-0" />
                            <span>{guardian.first_name ?? guardianName}</span>
                            <span className="font-normal text-muted-foreground tabular-nums">{guardian.phone}</span>
                          </a>
                        </li>
                      );
                    })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("roster.noPhone")}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SummaryItem({ dot, value, label }: { dot: string; value: number; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("size-2.5 rounded-full", dot)} />
      <span>
        <span className="font-bold">{value}</span> {label}
      </span>
    </li>
  );
}
