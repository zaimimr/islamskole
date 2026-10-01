"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Smartphone } from "lucide-react";
import {
  confirmPhoneLink,
  removeLoginPhone,
  requestPhoneLinkCode,
  type SmsPhoneError,
} from "@/lib/portal/sms-phone-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "view" | "phone" | "code";

export function SmsPhoneSection({ phone, display }: { phone: string | null; display: string | null }) {
  const t = useTranslations("portal.smsPhone");
  const tErrors = useTranslations("portal.errors");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(phone ? "view" : "phone");
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<SmsPhoneError | null>(null);

  function errorText(value: SmsPhoneError) {
    if (value === "invalid") return t(step === "code" ? "invalidCode" : "invalidPhone");
    if (value === "wrong_code") return t("wrongCode");
    if (value === "disabled") return t("disabled");
    return tErrors(value);
  }

  function sendCode() {
    const formData = new FormData();
    formData.set("phone", number);
    formData.set("locale", locale);
    setError(null);
    startTransition(async () => {
      const result = await requestPhoneLinkCode(formData);
      if (result.ok) {
        setCode("");
        setStep("code");
      } else setError(result.error);
    });
  }

  function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("phone", number);
    formData.set("code", code);
    setError(null);
    startTransition(async () => {
      const result = await confirmPhoneLink(formData);
      if (result.ok) {
        toast.success(t("saved"));
        setStep("view");
      } else setError(result.error);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeLoginPhone();
      if (result.ok) {
        toast.success(t("removed"));
        setStep("phone");
      } else setError(result.error);
    });
  }

  const errorId = "sms-phone-error";
  const errorBox = error ? (
    <p id={errorId} role="alert" className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {errorText(error)}
    </p>
  ) : null;

  return (
    <section aria-labelledby="sms-phone-title" className="soft-card grid gap-4 p-5 sm:p-6">
      <div className="grid gap-1">
        <h2 id="sms-phone-title" className="flex items-center gap-2 font-heading text-xl font-semibold">
          <Smartphone aria-hidden="true" className="size-5 text-brand-green-dark" />
          {t("title")}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">{t("intro")}</p>
      </div>
      {errorBox}

      {step === "view" && phone ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-pretty">{t("linked", { phone: display ?? phone })}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setStep("phone")}>
              {t("change")}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={remove} className="text-destructive">
              {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {t("remove")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "phone" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendCode();
          }}
          className="grid gap-3 sm:max-w-md"
        >
          <div className="grid gap-2">
            <Label htmlFor="sms-phone-number" required>
              {t("phoneLabel")}
            </Label>
            <Input
              id="sms-phone-number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              aria-invalid={error === "invalid" || undefined}
              aria-describedby={error ? `sms-phone-hint ${errorId}` : "sms-phone-hint"}
            />
            <p id="sms-phone-hint" className="text-sm text-muted-foreground">
              {t("phoneHint")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {t("sendCode")}
            </Button>
            {phone ? (
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setStep("view")}>
                {t("cancel")}
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}

      {step === "code" ? (
        <form onSubmit={confirm} className="grid gap-3 sm:max-w-md">
          <p role="status" className="text-sm text-pretty">
            {t("sent", { phone: number })}
          </p>
          <div className="grid gap-2">
            <Label htmlFor="sms-phone-code" required>
              {t("codeLabel")}
            </Label>
            <Input
              id="sms-phone-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              required
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
              aria-invalid={error === "invalid" || error === "wrong_code" || undefined}
              aria-describedby={error ? errorId : undefined}
              className="text-lg tracking-[0.3em]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {t("confirm")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setError(null);
                setStep("phone");
              }}
            >
              {t("otherNumber")}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
