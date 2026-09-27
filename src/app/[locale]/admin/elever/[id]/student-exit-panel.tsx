"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, LogOut, Trash2 } from "lucide-react";
import {
  archiveStudent,
  deleteStudent,
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

export function StudentExitPanel({
  studentId,
  studentName,
  hasActivePlacement,
  deleteBlockers,
  listHref,
}: {
  studentId: string;
  studentName: string;
  hasActivePlacement: boolean;
  deleteBlockers: string[];
  listHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function archive() {
    startTransition(async () => {
      const result = await archiveStudent(studentId);
      if (result.ok) {
        toast.success(`${studentName} er registrert som sluttet`, {
          description: result.note,
        });
        setArchiveOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteStudent(studentId);
      if (result.ok) {
        toast.success("Elevoppføringen er slettet");
        setDeleteOpen(false);
        router.replace(listHref);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const canDelete = deleteBlockers.length === 0;

  return (
    <section className="grid gap-4 rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] sm:p-5">
      <div>
        <h2 className="font-heading text-xl font-bold">Eleven slutter</h2>
        <p className="mt-1 max-w-prose text-sm text-admin-muted">
          Når en elev slutter, avsluttes plassene. Familie, betalinger og
          historikk blir stående.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
          <AlertDialogTrigger
            render={
              <Button
                type="button"
                variant="outline"
                disabled={pending || !hasActivePlacement}
                className="font-bold"
              >
                <LogOut aria-hidden="true" className="size-4" />
                Eleven har sluttet
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Registrere at {studentName} har sluttet?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Alle aktive plasser settes til avsluttet og frigjør plass i
                klassen. Årspris og betalinger endres ikke. Gi fritak under
                Betaling hvis familien ikke skal betale resten.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction onClick={archive} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Eleven har sluttet
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {canDelete ? (
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  className="font-bold"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  Slett elev
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Slette {studentName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Bruk dette bare når eleven ble registrert ved en feil.
                  Elevoppføringen og plassene slettes permanent, og påmeldingen
                  arkiveres så den ikke dukker opp i Opptak igjen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={remove}
                  disabled={pending}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Slett permanent
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
      {!hasActivePlacement ? (
        <p className="text-sm text-admin-muted">
          Eleven har ingen aktive plasser.
        </p>
      ) : null}
      {!canDelete ? (
        <p className="text-sm text-admin-muted">
          Eleven kan ikke slettes fordi det finnes {deleteBlockers.join(", ")}.
          Bruk «Eleven har sluttet», så beholdes historikken.
        </p>
      ) : null}
    </section>
  );
}
