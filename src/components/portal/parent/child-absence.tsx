"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, CalendarX2, Loader2, Undo2 } from "lucide-react";
import { reportAbsence, withdrawAbsence } from "@/lib/portal/actions";
import type { PortalErrorCode } from "@/lib/portal/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type AbsenceDay = { id: string; label: string; reported: boolean };
type AbsenceReportItem = { id: string; label: string; reason: string | null };

export function ChildAbsence({
  studentId,
  classId,
  childName,
  days,
  reports,
}: {
  studentId: string;
  classId: string;
  childName: string;
  days: AbsenceDay[];
  reports: AbsenceReportItem[];
}) {
  const t = useTranslations("portal");
  const [open, setOpen] = useState(false);
  const [dayId, setDayId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<PortalErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const openDays = days.filter((day) => !day.reported);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setDayId(openDays[0]?.id ?? "");
      setReason("");
      setError(null);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dayId) {
      setError("invalid");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await reportAbsence(studentId, dayId, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast.success(t("parent.absence.sent", { name: childName }));
    });
  }

  function handleWithdraw(id: string) {
    setWithdrawingId(id);
    startTransition(async () => {
      const result = await withdrawAbsence(id);
      setWithdrawingId(null);
      if (result.ok) toast.success(t("parent.absence.withdrawn"));
      else toast.error(t(`errors.${result.error}`));
    });
  }

  return (
    <div className="grid gap-3">
      {reports.length ? (
        <ul className="grid gap-2" aria-label={t("parent.absence.reportedTitle")}>
          {reports.map((report) => (
            <li
              key={report.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-secondary/70 py-2 pr-2 pl-4 text-secondary-foreground"
            >
              <p className="mr-auto min-w-0 text-sm">
                <span className="font-semibold">{t("parent.absence.reportedFor", { day: report.label })}</span>
                {report.reason ? <span className="block text-secondary-foreground/85">{report.reason}</span> : null}
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleWithdraw(report.id)}
                disabled={pending}
                aria-label={t("parent.absence.undoFor", { day: report.label })}
                className="text-secondary-foreground hover:bg-secondary"
              >
                {withdrawingId === report.id ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <Undo2 aria-hidden="true" />
                )}
                {t("parent.absence.undo")}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {days.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("parent.absence.noDays")}</p>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger
            render={<Button type="button" variant="outline" className="w-full sm:w-fit" disabled={!openDays.length} />}
          >
            <CalendarX2 aria-hidden="true" />
            {t("parent.absence.open")}
          </DialogTrigger>
          <DialogContent closeLabel={t("common.close")} className="gap-5 rounded-3xl p-5 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="pr-8 font-heading text-xl font-semibold">
                {t("parent.absence.title", { name: childName })}
              </DialogTitle>
              <DialogDescription>{t("parent.absence.intro")}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-5">
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-semibold">{t("parent.absence.dayLabel")}</legend>
                {days.map((day) => (
                  <label
                    key={day.id}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-foreground/10 transition-colors has-checked:bg-primary/10 has-checked:ring-2 has-checked:ring-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                      day.reported && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <input
                      type="radio"
                      name="school_day"
                      value={day.id}
                      checked={dayId === day.id}
                      disabled={day.reported}
                      onChange={() => setDayId(day.id)}
                      className="size-4 accent-[var(--brand-green-dark)]"
                    />
                    <span className="first-letter:uppercase">{day.label}</span>
                    {day.reported ? (
                      <span className="ml-auto text-xs font-semibold text-muted-foreground">
                        {t("parent.absence.alreadyReported")}
                      </span>
                    ) : null}
                  </label>
                ))}
              </fieldset>
              <div className="grid gap-2">
                <Label htmlFor={`absence-reason-${studentId}-${classId}`}>{t("parent.absence.reasonLabel")}</Label>
                <Textarea
                  id={`absence-reason-${studentId}-${classId}`}
                  value={reason}
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t("parent.absence.reasonPlaceholder")}
                  className="min-h-20 text-base"
                />
              </div>
              {error ? (
                <p role="alert" className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {t(`errors.${error}`)}
                </p>
              ) : null}
              <DialogFooter className="-mx-5 -mb-5 rounded-b-3xl p-5">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={pending || !dayId}>
                  {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
                  {t("parent.absence.submit")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
