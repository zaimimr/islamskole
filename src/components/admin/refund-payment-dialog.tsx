"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Undo2 } from "lucide-react";
import { refundVippsPayment } from "@/app/[locale]/admin/students-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function formatNok(ore: number) {
  return `${(ore / 100).toLocaleString("nb-NO")} kr`;
}

export function RefundPaymentDialog({
  paymentId,
  amount,
  payerName,
  childNames,
}: {
  paymentId: string;
  amount: number;
  payerName: string | null;
  childNames: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function refund() {
    startTransition(async () => {
      const result = await refundVippsPayment(paymentId);
      if (result.ok) {
        toast.success(`${formatNok(amount)} refundert`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            title="Refunder hele betalingen til foresatt"
            className="min-h-11 rounded-xl px-3 font-bold"
          >
            <Undo2 className="size-4" />
            Refunder
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <span className="mb-2 flex size-11 items-center justify-center rounded-full bg-[#F9DEDB] text-[#8B2F2B]">
            <Undo2 aria-hidden="true" className="size-5" />
          </span>
          <DialogTitle className="font-heading text-2xl">
            Refunder betaling
          </DialogTitle>
          <DialogDescription>
            Dette betaler {formatNok(amount)} tilbake
            {payerName ? ` til ${payerName}` : " til foresatt"} via Vipps.
            Pengene forlater kontoen med én gang, og handlingen kan ikke angres.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 text-sm">
          <div className="rounded-xl bg-[#FFF8E9] px-4 py-4 text-[#6B5524] ring-1 ring-[#E8D6AA]">
            <p className="text-xs font-bold tracking-[0.04em] uppercase">
              Beløp som betales tilbake
            </p>
            <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
              {formatNok(amount)}
            </p>
          </div>

          {childNames.length > 0 ? (
            <div className="flex gap-3 rounded-xl bg-[#F9DEDB] p-4 text-[#6F2926] ring-1 ring-[#E8B9B5]">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0"
              />
              <p>
                Betalingen dekker {childNames.join(", ")}. Etter refusjonen
                teller den ikke lenger som betalt, og{" "}
                {childNames.length === 1 ? "barnet" : "barna"} vil stå med
                utestående beløp igjen.
              </p>
            </div>
          ) : null}

          <p className="text-admin-muted">
            Denne handlingen refunderer hele det tilgjengelige beløpet. Den kan
            ikke angres i systemet.
          </p>
        </div>

        <DialogFooter className="[&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:rounded-xl [&_[data-slot=button]]:px-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Avbryt
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={refund}
            disabled={pending}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Refunder {formatNok(amount)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
