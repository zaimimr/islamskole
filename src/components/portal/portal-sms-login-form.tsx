"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Loader2, MessageSquareText } from "lucide-react";
import {
  requestSmsLoginCode,
  verifySmsLoginCode,
  type SmsLoginError,
} from "@/lib/portal/sms-login-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PortalSmsLoginForm({ next }: { next?: string }) {
  const t = useTranslations("portal");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<SmsLoginError | null>(null);
  const loadedAt = useRef<number | null>(null);

  useEffect(() => {
    loadedAt.current = Date.now();
  }, []);

  function requestCode(formData: FormData) {
    formData.set("phone", phone);
    formData.set("loaded_at", String(loadedAt.current ?? Date.now()));
    formData.set("locale", locale);
    setError(null);
    startTransition(async () => {
      const result = await requestSmsLoginCode(formData);
      if (result.ok) {
        setCode("");
        setStep("code");
      } else setError(result.error);
    });
  }

  function handlePhoneSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    requestCode(new FormData(event.currentTarget));
  }

  function handleCodeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("phone", phone);
    formData.set("code", code);
    formData.set("locale", locale);
    if (next) formData.set("next", next);
    setError(null);
    startTransition(async () => {
      const result = await verifySmsLoginCode(formData);
      if (!result.ok) setError(result.error);
    });
  }

  function errorText(value: SmsLoginError) {
    if (value === "invalid") return t(step === "phone" ? "login.sms.invalidPhone" : "login.sms.invalidCode");
    if (value === "wrong_code") return t("login.sms.wrongCode");
    if (value === "disabled") return t("login.sms.disabled");
    return t(`errors.${value}`);
  }

  const errorBox = error ? (
    <p role="alert" className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {errorText(error)}
    </p>
  ) : null;

  if (step === "code") {
    return (
      <form onSubmit={handleCodeSubmit} className="grid gap-4">
        <div role="status" className="grid gap-2 rounded-2xl bg-primary/10 p-5 text-brand-green-dark">
          <p className="flex items-center gap-2 font-heading text-lg font-semibold">
            <MessageSquareText aria-hidden="true" className="size-5 shrink-0" />
            {t("login.sms.sentTitle")}
          </p>
          <p className="text-sm text-foreground">{t("login.sms.sent", { phone })}</p>
        </div>
        {errorBox}
        <div className="grid gap-2">
          <Label htmlFor="portal-sms-code" required>
            {t("login.sms.codeLabel")}
          </Label>
          <Input
            id="portal-sms-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-invalid={error === "invalid" || error === "wrong_code" || undefined}
            className="text-lg tracking-[0.3em]"
          />
        </div>
        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          {t("login.sms.verify")}
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => requestCode(new FormData())}
          >
            {t("login.sms.resend")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              loadedAt.current = Date.now();
              setError(null);
              setStep("phone");
            }}
          >
            {t("login.sms.otherNumber")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handlePhoneSubmit} className="grid gap-4">
      {errorBox}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="hp_field_sms">La stå tom</label>
        <input id="hp_field_sms" name="hp_field_t" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="portal-phone" required>
          {t("login.sms.phoneLabel")}
        </Label>
        <Input
          id="portal-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          aria-invalid={error === "invalid" || undefined}
          aria-describedby="portal-phone-hint"
        />
        <p id="portal-phone-hint" className="text-sm text-muted-foreground">
          {t("login.sms.phoneHint")}
        </p>
      </div>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
        {t("login.sms.sendCode")}
      </Button>
    </form>
  );
}
