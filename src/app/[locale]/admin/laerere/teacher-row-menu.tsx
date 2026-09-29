"use client";

import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { KeyRound, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { sendLoginLinkToGuardian } from "@/app/[locale]/admin/portal-admin-actions";
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
import { TeacherEditDialog, type EditableTeacher } from "./teacher-edit-dialog";

export function TeacherRowMenu({
  teacher,
  name,
  canSendLink,
}: {
  teacher: EditableTeacher;
  name: string;
  canSendLink: boolean;
}) {
  const guardianId = teacher.id;
  const locale = useLocale();
  const removeRow = useRemoveRow();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [, startTransition] = useTransition();

  function sendLink() {
    startTransition(async () => {
      const result = await sendLoginLinkToGuardian(guardianId, locale);
      if (result.ok) toast.success(`Innloggingslenke sendt til ${teacher.email}`);
      else toast.error(result.error);
    });
  }

  function handleConfirm() {
    setConfirmOpen(false);
    removeRow(
      guardianId,
      () => removeTeacher(guardianId),
      "Læreren er fjernet, og klassene er uten denne læreren",
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
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden="true" />
            Rediger
          </DropdownMenuItem>
          {canSendLink ? (
            <DropdownMenuItem onClick={sendLink}>
              <KeyRound aria-hidden="true" />
              Send innloggingslenke
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 aria-hidden="true" />
            Fjern som lærer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fjerne {name} som lærer?</AlertDialogTitle>
            <AlertDialogDescription>
              Personen beholdes som foresatt, men vises ikke lenger som lærer og
              fjernes fra alle klasser. Lærerbarn-fradrag som allerede er gitt beholdes i historikken.
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

      <TeacherEditDialog teacher={teacher} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
