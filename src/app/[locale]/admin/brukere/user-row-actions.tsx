"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  MoreHorizontal,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { deleteUser, resetUserPassword } from "@/app/[locale]/admin/actions";
import { useRemoveRow } from "@/components/admin/optimistic-removal-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export function UserRowActions({
  userId,
  email,
  canDelete,
}: {
  userId: string;
  email: string;
  canDelete: boolean;
}) {
  const removeRow = useRemoveRow();
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleReset() {
    startTransition(async () => {
      const result = await resetUserPassword(userId);
      if (result.ok) {
        setPassword(result.password);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    setDeleteOpen(false);
    removeRow(userId, () => deleteUser(userId), "Brukeren er slettet");
  }

  async function copyPassword() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success("Passord kopiert");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kunne ikke kopiere. Marker passordet og kopier det selv.");
    }
  }

  function handleResetOpenChange(next: boolean) {
    setResetOpen(next);
    if (!next) {
      setPassword(null);
      setCopied(false);
    }
  }

  return (
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
          <DropdownMenuItem onClick={() => setResetOpen(true)}>
            <KeyRound aria-hidden="true" />
            Lag nytt passord
          </DropdownMenuItem>
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 aria-hidden="true" />
                Slett bruker
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={resetOpen} onOpenChange={handleResetOpenChange}>
        <DialogContent className="rounded-2xl border-[#E3DED3] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lag nytt passord</DialogTitle>
            <DialogDescription>{email}</DialogDescription>
          </DialogHeader>
          {password ? (
            <div
              className="grid gap-3 rounded-xl bg-[#F0F8F1] p-4 ring-1 ring-[#B7D7BA]"
              aria-live="polite"
            >
              <Label htmlFor={`password-${userId}`}>Nytt passord</Label>
              <div className="flex gap-2">
                <Input
                  id={`password-${userId}`}
                  readOnly
                  value={password}
                  className="bg-white font-mono shadow-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Kopier passord"
                  title="Kopier passord"
                  onClick={copyPassword}
                  className="bg-white"
                >
                  {copied ? (
                    <Check aria-hidden="true" className="size-4" />
                  ) : (
                    <Copy aria-hidden="true" className="size-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-admin-muted">
                Passordet vises bare nå. Gi det til brukeren på en trygg måte,
                og be dem bytte det under Min konto.
              </p>
            </div>
          ) : (
            <div className="flex gap-3 rounded-xl bg-[#FFF8E9] p-4 text-[#5E4108] ring-1 ring-[#E7CA91]">
              <ShieldAlert
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0"
              />
              <p className="text-sm">
                Det nåværende passordet slutter å virke med en gang. Brukeren
                kan også velge nytt passord selv med «Glemt passord?» på
                innloggingssiden.
              </p>
            </div>
          )}
          <DialogFooter>
            {password ? (
              <DialogClose render={<Button>Ferdig</Button>} />
            ) : (
              <>
                <DialogClose
                  render={
                    <Button type="button" variant="outline">
                      Avbryt
                    </Button>
                  }
                />
                <Button onClick={handleReset} disabled={pending}>
                  {pending ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : null}
                  Lag nytt passord
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canDelete ? (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Slette brukeren?</AlertDialogTitle>
              <AlertDialogDescription>
                {email} mister tilgangen til administrasjonen med en gang.
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
      ) : null}
    </>
  );
}
