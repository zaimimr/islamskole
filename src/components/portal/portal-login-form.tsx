"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, MailCheck } from "lucide-react";
import { sendPortalLoginLink } from "@/lib/portal/actions";
import type { PortalErrorCode } from "@/lib/portal/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PortalLoginForm({ invalidLink }: { invalidLink: boolean }) {
  const t = useTranslations("portal");
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<PortalErrorCode | null>(null);
  const loadedAt = useRef<number | null>(null);

  useEffect(() => {
    loadedAt.current = Date.now();
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("loaded_at", String(loadedAt.current ?? Date.now()));
    setError(null);
    startTransition(async () => {
      const result = await sendPortalLoginLink(formData);
      if (result.ok) setSent(true);
      else setError(result.error);
    });
  }

  if (sent) {
    return (
      <div className="grid gap-4">
        <div role="status" className="grid gap-2 rounded-2xl bg-primary/10 p-5 text-brand-green-dark">
          <p className="flex items-center gap-2 font-heading text-lg font-semibold">
            <MailCheck aria-hidden="true" className="size-5 shrink-0" />
            {t("login.sentTitle")}
          </p>
          <p className="text-sm text-foreground">{t("login.sent")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            loadedAt.current = Date.now();
            setSent(false);
          }}
        >
          {t("login.again")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {invalidLink ? (
        <p role="alert" className="flex gap-2 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("login.invalidLink")}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t(`errors.${error}`)}
        </p>
      ) : null}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="hp_field_t">La stå tom</label>
        <input id="hp_field_t" name="hp_field_t" type="text" tabIndex={-1} autoComplete="one-time-code" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="portal-email" required>
          {t("login.emailLabel")}
        </Label>
        <Input
          id="portal-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error === "invalid" || undefined}
        />
      </div>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
        {t("login.submit")}
      </Button>
    </form>
  );
}
