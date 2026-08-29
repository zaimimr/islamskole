"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { batchSendPaymentLinks } from "@/app/[locale]/admin/students-actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function BatchSendButton({
  schoolYearId,
  yearLabel,
}: {
  schoolYearId: string;
  yearLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await batchSendPaymentLinks(schoolYearId);
      if (result.ok) {
        toast.success(
          `Betalingslenke sendt til ${result.sent} foresatte${
            result.note ? ` · ${result.note}` : ""
          }`,
        );
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="outline" className="min-h-11 bg-white px-3">
            <Send className="size-4" />
            Send betalingslenke til ubetalte
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Send betalingslenke for {yearLabel}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Sender betalingslenke på e-post til foresatte for alle aktive elever
            dette skoleåret som ikke har betalt. Allerede betalte hoppes over.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11">Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pending}
            className="min-h-11"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Send
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
