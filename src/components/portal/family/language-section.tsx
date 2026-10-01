"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Languages, Loader2 } from "lucide-react";
import { updateFamilyPreferences } from "@/lib/portal/family-actions";
import { LANGUAGES, type PortalFamily } from "@/lib/portal/family-types";
import { useErrorText } from "@/components/portal/family/family-ui";

export function LanguageSection({ family }: { family: PortalFamily }) {
  const t = useTranslations("portal.family.language");
  const errorText = useErrorText();
  const [value, setValue] = useState(family.preferred_language === "en" ? "en" : "no");
  const [pending, startTransition] = useTransition();
  const idPrefix = `language-${family.id}`;

  function handleChange(next: string) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await updateFamilyPreferences(family.id, { preferredLanguage: next });
      if (result.ok) {
        toast.success(t("saved"));
        return;
      }
      setValue(previous);
      toast.error(errorText(result.error));
    });
  }

  return (
    <section aria-labelledby={`${idPrefix}-title`} className="grid gap-3 px-5 py-5 sm:px-6">
      <h3 id={`${idPrefix}-title`} className="flex items-center gap-2 font-heading text-lg font-semibold">
        <Languages aria-hidden="true" className="size-5 text-brand-green-dark" />
        {t("title")}
        {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin text-muted-foreground" /> : null}
      </h3>
      <p className="text-sm text-pretty text-muted-foreground">{t("intro")}</p>
      <fieldset className="grid grid-cols-2 gap-2" aria-labelledby={`${idPrefix}-title`} disabled={pending}>
        {LANGUAGES.map((language) => (
          <label
            key={language}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-foreground/10 transition-colors has-checked:bg-primary/10 has-checked:ring-2 has-checked:ring-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name={`${idPrefix}-value`}
              value={language}
              checked={value === language}
              onChange={() => handleChange(language)}
              className="size-4 shrink-0 accent-[var(--brand-green-dark)]"
            />
            {t(language)}
          </label>
        ))}
      </fieldset>
    </section>
  );
}
