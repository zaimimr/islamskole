"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Link2, Mail, Ban } from "lucide-react";
import {
  cancelVippsPayment,
  sendPaymentLink,
} from "@/app/[locale]/admin/students-actions";
import { Button } from "@/components/ui/button";

export function PaymentRowActions({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Noe gikk galt");
      }
    });
  }

  function copyLink() {
    const base = (
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
    ).replace(/\/$/, "");
    navigator.clipboard.writeText(`${base}/api/vipps/pay/${paymentId}`);
    toast.success("Betalingslenke kopiert");
  }

  return (
    <div className="flex justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Kopier betalingslenke"
        title="Kopier betalingslenke"
        onClick={copyLink}
      >
        <Link2 className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Send lenke på e-post"
        title="Send betalingslenke til foresatte på e-post"
        disabled={pending}
        onClick={() =>
          run(() => sendPaymentLink(paymentId), "Betalingslenke sendt")
        }
      >
        <Mail className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Avbryt betaling"
        title="Avbryt den ventende betalingen"
        disabled={pending}
        onClick={() =>
          run(() => cancelVippsPayment(paymentId), "Betaling avbrutt")
        }
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Ban className="size-4" />
        )}
      </Button>
    </div>
  );
}
