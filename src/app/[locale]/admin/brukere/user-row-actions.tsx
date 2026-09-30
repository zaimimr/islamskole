"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  GraduationCap,
  Loader2,
  MoreHorizontal,
  ShieldMinus,
  Trash2,
} from "lucide-react";
import {
  deleteUser,
  makeUserTeacher,
  removeAdminAccess,
} from "@/app/[locale]/admin/actions";
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

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function useResultToast(state: ActionResult | null, success: string) {
  const router = useRouter();
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(success);
    else toast.error(state.error);
    router.refresh();
  }, [state, success, router]);
}

function RowActionForm({
  userId,
  action,
  success,
  icon,
  label,
}: {
  userId: string;
  action: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  success: string;
  icon: React.ReactNode;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  useResultToast(state, success);
  return (
    <form action={formAction}>
      <input type="hidden" name="user_id" value={userId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : icon}
        {label}
      </Button>
    </form>
  );
}

export function UserRowActions({
  userId,
  email,
  isSelf,
  isAdmin,
  isTeacher,
}: {
  userId: string;
  email: string;
  isSelf: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
}) {
  const removeRow = useRemoveRow();
  const [deleteOpen, setDeleteOpen] = useState(false);

  function handleDelete() {
    setDeleteOpen(false);
    removeRow(userId, () => deleteUser(userId), "Brukeren er slettet");
  }

  return (
    <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
      {isTeacher ? null : (
        <RowActionForm
          userId={userId}
          action={makeUserTeacher}
          success={`${email} er registrert som lærer`}
          icon={<GraduationCap aria-hidden="true" />}
          label="Gjør til lærer"
        />
      )}
      {isAdmin && !isSelf ? (
        <RowActionForm
          userId={userId}
          action={removeAdminAccess}
          success={`${email} har ikke lenger administratortilgang`}
          icon={<ShieldMinus aria-hidden="true" />}
          label="Fjern administratortilgang"
        />
      ) : null}
      {isSelf ? null : (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Flere valg for ${email}`}
                  title={`Flere valg for ${email}`}
                  className="text-admin-muted hover:text-foreground"
                />
              }
            >
              <MoreHorizontal aria-hidden="true" className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-52">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 aria-hidden="true" />
                Slett bruker
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Slette brukeren?</AlertDialogTitle>
                <AlertDialogDescription>
                  {email} kan ikke lenger logge inn før de ber om en ny lenke.
                  Revisjonshistorikken beholder det brukeren har gjort.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete}>
                  Slett bruker
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
