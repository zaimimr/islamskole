"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { removeTeacher } from "@/app/[locale]/admin/familier/families-actions";
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

export function TeacherRemoveButton({
  guardianId,
  name,
}: {
  guardianId: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await removeTeacher(guardianId);
      if (result.ok) {
        toast.success("Læreren er fjernet fra registeret");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Noe gikk galt");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            className="h-8 rounded-lg px-2 text-xs font-bold text-[#8B2F2B]"
          >
            Fjern
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <span className="mb-2 flex size-11 items-center justify-center rounded-full bg-[#F9DEDB] text-[#8B2F2B]">
            <AlertTriangle aria-hidden="true" className="size-5" />
          </span>
          <AlertDialogTitle className="font-heading text-2xl">
            Fjerne {name} fra lærerregisteret?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Personen beholdes som foresatt, men vises ikke lenger som lærer.
            Lærerbarn-fradrag som allerede er gitt beholdes i historikken.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="[&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:rounded-xl [&_[data-slot=button]]:px-4">
          <AlertDialogCancel disabled={pending}>Avbryt</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Fjern lærer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
