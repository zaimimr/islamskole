"use client";

import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { removeTeacher } from "@/app/[locale]/admin/familier/families-actions";
import { useRemoveRow } from "@/components/admin/optimistic-removal-list";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function TeacherRowMenu({
  guardianId,
  name,
}: {
  guardianId: string;
  name: string;
}) {
  const removeRow = useRemoveRow();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleConfirm() {
    setConfirmOpen(false);
    removeRow(
      guardianId,
      () => removeTeacher(guardianId),
      "Læreren er fjernet fra registeret",
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Flere valg for ${name}`}
              title={`Flere valg for ${name}`}
              className="text-admin-muted hover:text-foreground"
            />
          }
        >
          <MoreHorizontal aria-hidden="true" className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-52">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 aria-hidden="true" />
            Fjern fra lærerregisteret
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fjerne {name} fra lærerregisteret?</AlertDialogTitle>
            <AlertDialogDescription>
              Personen beholdes som foresatt, men vises ikke lenger som lærer.
              Lærerbarn-fradrag som allerede er gitt beholdes i historikken.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirm}>
              Fjern lærer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
