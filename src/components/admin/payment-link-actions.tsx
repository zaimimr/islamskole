"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Loader2, Mail, RefreshCw } from "lucide-react";
import {
  cancelVippsPayment,
  sendPaymentLink,
  syncPaymentStatus,
} from "@/app/[locale]/admin/students-actions";
import { Button } from "@/components/ui/button";

export function PaymentLinkActions({ paymentId }: { paymentId: string }) {
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

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          run(() => sendPaymentLink(paymentId), "Betalingslenke sendt")
        }
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Mail className="size-4" />
        )}
        Send på nytt
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          run(() => syncPaymentStatus(paymentId), "Status oppdatert")
        }
      >
        <RefreshCw className="size-4" />
        Hent status
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          run(() => cancelVippsPayment(paymentId), "Betaling avbrutt")
        }
      >
        <Ban className="size-4" />
        Avbryt
      </Button>
    </>
  );
}
