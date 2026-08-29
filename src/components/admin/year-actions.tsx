"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw, CopyPlus } from "lucide-react";
import {
  syncAllPaymentsForYear,
  copyEnrollmentsToActiveYear,
} from "@/app/[locale]/admin/students-actions";
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

export function YearActions({
  schoolYearId,
  isActiveYear,
  activeYearLabel,
}: {
  schoolYearId: string;
  isActiveYear: boolean;
  activeYearLabel: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copyOpen, setCopyOpen] = useState(false);

  function syncAll() {
    startTransition(async () => {
      const result = await syncAllPaymentsForYear(schoolYearId);
      if (result.ok) {
        toast.success(`Oppdaterte ${result.synced} betalinger`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function copyToActive() {
    startTransition(async () => {
      const result = await copyEnrollmentsToActiveYear(schoolYearId);
      if (result.ok) {
        toast.success(
          `Kopierte ${result.moved} elever til ${activeYearLabel}${
            result.note ? ` · ${result.note}` : ""
          }`,
        );
        setCopyOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={syncAll}
        className="min-h-11 bg-white px-3"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        Synkroniser betalinger
      </Button>

      {!isActiveYear && activeYearLabel ? (
        <AlertDialog open={copyOpen} onOpenChange={setCopyOpen}>
          <AlertDialogTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className="min-h-11 bg-white px-3"
              >
                <CopyPlus className="size-4" />
                Kopier elever til {activeYearLabel}
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Kopier elever til {activeYearLabel}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Plasserer alle aktive elever fra dette skoleåret i samme klasse
                for {activeYearLabel}. Elever som allerede er plassert hoppes
                over. Du kan endre klasse på enkeltelever etterpå.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11">Avbryt</AlertDialogCancel>
              <AlertDialogAction
                onClick={copyToActive}
                disabled={pending}
                className="min-h-11"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Kopier
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}
