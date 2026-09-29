"use client";

import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { setContinues } from "@/lib/portal/enrollment-actions";
import { cn } from "@/lib/utils";

export function ContinuesQuestion({
  studentId,
  name,
  value,
}: {
  studentId: string;
  name: string;
  value: boolean | null;
}) {
  const t = useTranslations("portal.enroll.continues");
  const tErrors = useTranslations("portal.errors");
  const [pending, startTransition] = useTransition();
  const [answer, setAnswer] = useOptimistic(value);

  function choose(next: boolean) {
    startTransition(async () => {
      setAnswer(next);
      const result = await setContinues(studentId, next);
      if (result.ok) toast.success(t("saved", { name }));
      else toast.error(tErrors(result.error));
    });
  }

  return (
    <li className="grid gap-3 px-5 py-4 sm:px-6">
      <div className="grid gap-0.5">
        <p className="font-semibold text-pretty">{t("question", { name })}</p>
        <p className="text-sm text-muted-foreground">
          {answer === null ? t("unanswered") : answer ? t("answeredYes") : t("answeredNo")}
        </p>
      </div>
      <div role="group" aria-label={t("question", { name })} className="grid grid-cols-2 gap-2 sm:w-72">
        {([true, false] as const).map((option) => {
          const selected = answer === option;
          const Icon = option ? Check : X;
          return (
            <button
              key={String(option)}
              type="button"
              aria-pressed={selected}
              disabled={pending}
              onClick={() => {
                if (!selected) choose(option);
              }}
              className={cn(
                "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-3 font-bold ring-1 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70",
                selected
                  ? option
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-foreground text-background ring-foreground"
                  : "bg-background ring-foreground/12 hover:bg-muted",
              )}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {option ? t("yes") : t("no")}
            </button>
          );
        })}
      </div>
    </li>
  );
}
