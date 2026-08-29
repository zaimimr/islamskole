"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Loader2, Mail, MoreHorizontal, RefreshCw } from "lucide-react";
import {
  cancelVippsPayment,
  sendPaymentLink,
  syncPaymentStatus,
} from "@/app/[locale]/admin/students-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl px-3 font-bold"
            disabled={pending}
          />
        }
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <MoreHorizontal className="size-4" />
        )}
        Vipps
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem
          className="min-h-11"
          onClick={() =>
            run(() => sendPaymentLink(paymentId), "Betalingslenke sendt")
          }
        >
          <Mail className="size-4" />
          Send betalingslenke på nytt
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-11"
          onClick={() =>
            run(() => syncPaymentStatus(paymentId), "Status oppdatert")
          }
        >
          <RefreshCw className="size-4" />
          Hent status fra Vipps
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-11 text-[#8B2F2B]"
          onClick={() =>
            run(() => cancelVippsPayment(paymentId), "Betaling avbrutt")
          }
        >
          <Ban className="size-4" />
          Avbryt betalingsforespørsel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
