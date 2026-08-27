"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";
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
            size="sm"
            title="Refunder hele betalingen til foresatt"
          >
            <Undo2 className="size-4" />
            Refunder
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refunder betaling</DialogTitle>
          <DialogDescription>
            Dette betaler {formatNok(amount)} tilbake
            {payerName ? ` til ${payerName}` : " til foresatt"} via Vipps.
            Pengene forlater kontoen med én gang, og handlingen kan ikke angres.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2 text-sm">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Beløp</p>
            <p className="text-xl font-bold">{formatNok(amount)}</p>
          </div>

          {childNames.length > 0 ? (
            <p className="text-muted-foreground">
              Betalingen dekker {childNames.join(", ")}. Etter refusjonen
              teller den ikke lenger som betalt, og{" "}
              {childNames.length === 1 ? "barnet" : "barna"} vil stå med
              utestående beløp igjen.
            </p>
          ) : null}

          <p className="text-muted-foreground">
            Hele beløpet refunderes. Trenger du å betale tilbake bare deler av
            en betaling, si fra - det krever en egen delrefusjon.
          </p>
        </div>

        <DialogFooter>
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
