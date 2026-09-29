"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { confirmEmailChange, type EmailChangeConfirmResult } from "@/lib/portal/family-actions";
import { Button } from "@/components/ui/button";
import { ErrorNote } from "@/components/portal/family/family-ui";

export function ConfirmEmailForm({ token, email }: { token: string; email: string }) {
  const t = useTranslations("portal.family.confirm");
  const locale = useLocale();
  const [result, setResult] = useState<EmailChangeConfirmResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setResult(await confirmEmailChange(token, locale));
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <h1 className="font-heading text-3xl font-semibold text-balance">{t("title")}</h1>
      <p className="text-pretty break-words">{t("intro", { email })}</p>
      {result ? <ErrorNote message={t(result.error)} /> : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-fit">
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
        {t("submit")}
      </Button>
    </form>
  );
}
