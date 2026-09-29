"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Eye, HeartPulse, Loader2 } from "lucide-react";
import { updateChildHealth } from "@/lib/portal/family-actions";
import type { FamilyChild } from "@/lib/portal/family-types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote, Field, formText, useErrorText } from "@/components/portal/family/family-ui";

const CONSENT_OPTIONS = [
  { value: "yes", key: "photoYes" },
  { value: "no", key: "photoNo" },
  { value: "unanswered", key: "photoUnanswered" },
] as const;

function consentValue(consent: boolean | null) {
  if (consent === true) return "yes";
  if (consent === false) return "no";
  return "unanswered";
}

function formatDate(value: string, locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "nb-NO", options).format(new Date(value));
}

export function ChildHealthForm({ child }: { child: FamilyChild }) {
  const t = useTranslations("portal.family.children");
  const tFamily = useTranslations("portal.family");
  const locale = useLocale();
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const name = [child.first_name, child.last_name].filter(Boolean).join(" ");
  const firstName = child.first_name ?? name;
  const idPrefix = `child-${child.id}`;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const consent = formText(form, "photo_consent");
    setError(null);
    startTransition(async () => {
      const result = await updateChildHealth(child.id, {
        allergies: formText(form, "allergies"),
        medicalNotes: formText(form, "medical_notes"),
        photoConsent: consent === "yes" ? true : consent === "no" ? false : null,
      });
      if (!result.ok) {
        setError(errorText(result.error));
        return;
      }
      toast.success(t("saved", { name: firstName }));
    });
  }

  return (
    <li data-testid="family-child" className="grid gap-4 rounded-2xl p-4 ring-1 ring-foreground/10">
      <div className="grid gap-0.5">
        <h4 id={`${idPrefix}-name`} className="font-heading text-lg font-semibold text-balance">{name}</h4>
        {child.birth_date ? (
          <p className="text-sm">
            {t("born", { date: formatDate(child.birth_date, locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) })}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">{t("wrongInfo")}</p>
      </div>

      <form onSubmit={handleSubmit} aria-labelledby={`${idPrefix}-name`} className="grid gap-4">
        <p className="flex items-center gap-2 text-sm font-bold text-brand-green-dark">
          <HeartPulse aria-hidden="true" className="size-4" />
          {t("healthTitle")}
        </p>
        <Field id={`${idPrefix}-allergies`} label={t("allergies")} hint={t("allergiesHint")}>
          <Textarea
            id={`${idPrefix}-allergies`}
            name="allergies"
            maxLength={1000}
            defaultValue={child.allergies ?? ""}
            aria-describedby={`${idPrefix}-allergies-hint`}
            className="min-h-16 text-base"
          />
        </Field>
        <Field id={`${idPrefix}-medical`} label={t("medical")} hint={t("medicalHint")}>
          <Textarea
            id={`${idPrefix}-medical`}
            name="medical_notes"
            maxLength={2000}
            defaultValue={child.medical_notes ?? ""}
            aria-describedby={`${idPrefix}-medical-hint`}
            className="min-h-16 text-base"
          />
        </Field>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{t("photo")}</legend>
          <p className="mb-1 text-sm text-pretty">{t("photoQuestion", { name: firstName })}</p>
          <div className="grid grid-cols-3 gap-2">
            {CONSENT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 ring-foreground/10 transition-colors has-checked:bg-primary/10 has-checked:ring-2 has-checked:ring-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              >
                <input
                  type="radio"
                  name="photo_consent"
                  value={option.value}
                  defaultChecked={consentValue(child.photo_consent) === option.value}
                  className="size-4 shrink-0 accent-[var(--brand-green-dark)]"
                />
                {t(option.key)}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="flex gap-2 text-sm text-muted-foreground">
          <Eye aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {t("teachersSee", { name: firstName })}
            {child.health_updated_at ? (
              <span className="block">
                {t("updated", {
                  date: formatDate(child.health_updated_at, locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Oslo" }),
                })}
              </span>
            ) : null}
          </span>
        </p>
        {error ? <ErrorNote message={error} /> : null}
        <Button type="submit" disabled={pending} className="w-full sm:w-fit">
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          {tFamily("save")}
        </Button>
      </form>
    </li>
  );
}
