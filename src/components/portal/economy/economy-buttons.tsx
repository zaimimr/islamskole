"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  payInstallment,
  payRemaining,
  sendEconomyReceipt,
  type EconomyErrorCode,
} from "@/lib/portal/economy-actions";
import { cn } from "@/lib/utils";

function useErrorText() {
  const t = useTranslations("portal");
  return (code: EconomyErrorCode) =>
    code === "settled" ? t("economy.errors.settled") : t(`errors.${code}`);
}

export function VippsPayButton({
  familyId,
  installmentId,
  label,
  className,
}: {
  familyId: string;
  installmentId?: string;
  label: string;
  className?: string;
}) {
  const t = useTranslations("portal.economy");
  const lang = useLocale() === "en" ? "en" : "no";
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = installmentId
        ? await payInstallment(familyId, installmentId, lang)
        : await payRemaining(familyId, lang);
      if (!result.ok) {
        toast.error(errorText(result.error));
        return;
      }
      window.location.assign(result.url);
    });
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "h-12 rounded-xl bg-[#ff5b24] px-5 text-base font-semibold text-white hover:bg-[#e64f1a] focus-visible:ring-[#ff5b24]/40",
        className,
      )}
    >
      {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
      {pending ? t("opening") : label}
    </Button>
  );
}

export function ReceiptButton({ paymentId }: { paymentId: string }) {
  const t = useTranslations("portal.economy.history");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await sendEconomyReceipt(paymentId);
      if (result.ok) toast.success(t("receiptSent"));
      else toast.error(errorText(result.error));
    });
  }

  return (
    <Button type="button" variant="ghost" onClick={handleClick} disabled={pending} className="-ml-2 min-h-11 w-fit">
      {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Mail aria-hidden="true" />}
      {t("receipt")}
    </Button>
  );
}
