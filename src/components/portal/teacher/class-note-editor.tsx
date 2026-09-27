"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CircleCheck, Loader2 } from "lucide-react";
import { saveClassNote } from "@/lib/portal/actions";
import { formatSavedAt } from "@/lib/portal/teacher-days";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Saved = { homework: string; summary: string; label: string | null };

export function ClassNoteEditor({
  classId,
  schoolDayId,
  initialHomework,
  initialSummary,
  savedLabel,
  disabled,
}: {
  classId: string;
  schoolDayId: string;
  initialHomework: string;
  initialSummary: string;
  savedLabel: string | null;
  disabled: boolean;
}) {
  const t = useTranslations("portal.teacher.note");
  const tErrors = useTranslations("portal.errors");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [homework, setHomework] = useState(initialHomework);
  const [summary, setSummary] = useState(initialSummary);
  const [saved, setSaved] = useState<Saved>({
    homework: initialHomework,
    summary: initialSummary,
    label: savedLabel,
  });
  const dirty = homework.trim() !== saved.homework.trim() || summary.trim() !== saved.summary.trim();
  const empty = !homework.trim() && !summary.trim() && !saved.label;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || disabled) return;
    const next = { homework, summary };
    startTransition(async () => {
      const result = await saveClassNote(classId, schoolDayId, next);
      if (result.ok) setSaved({ ...next, label: formatSavedAt(new Date().toISOString(), locale) });
      else toast.error(tErrors(result.error));
    });
  }

  const savedTime = saved.label;

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/8 sm:p-5">
      <div className="grid gap-2">
        <Label htmlFor="note-homework">{t("homework")}</Label>
        <Textarea
          id="note-homework"
          name="homework"
          value={homework}
          onChange={(event) => setHomework(event.target.value)}
          maxLength={2000}
          rows={3}
          disabled={disabled}
          placeholder={t("homeworkPlaceholder")}
          className="min-h-24 text-base"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="note-summary">{t("summary")}</Label>
        <Textarea
          id="note-summary"
          name="summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          maxLength={2000}
          rows={4}
          disabled={disabled}
          placeholder={t("summaryPlaceholder")}
          className="min-h-28 text-base"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={disabled || pending || !dirty}>
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          {t("save")}
        </Button>
        <p role="status" className="flex items-center gap-1.5 text-sm">
          {pending ? (
            <span className="text-muted-foreground">{t("saving")}</span>
          ) : dirty ? (
            <span className="font-semibold text-secondary-foreground">{t("unsaved")}</span>
          ) : savedTime ? (
            <>
              <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-admin-action" />
              <span className="text-muted-foreground">{t("savedAt", { time: savedTime })}</span>
            </>
          ) : empty ? (
            <span className="text-muted-foreground">{t("notWritten")}</span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
