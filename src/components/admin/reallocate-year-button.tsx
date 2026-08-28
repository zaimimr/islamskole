"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Split } from "lucide-react";
import { reallocateYearPayments } from "@/app/[locale]/admin/students-actions";
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

export function ReallocateYearButton({
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
      const result = await reallocateYearPayments(schoolYearId);
      if (result.ok) {
        toast.success(`${result.count} betalinger fordelt på nytt`);
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
          <Button variant="outline">
            <Split className="size-4" />
            Fordel betalinger på nytt
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Fordele betalingene for {yearLabel} på nytt?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Alle innbetalinger for skoleåret fordeles på barna på nytt, eldste
            først. Bruk dette når et søsken ble registrert etter at foresatt
            betalte for flere barn, slik at ett barn viser for mye betalt og et
            annet for lite. Manuelle fordelinger du har gjort selv overskrives.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Fordel på nytt
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
