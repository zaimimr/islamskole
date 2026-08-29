"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { resetUserPassword } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ResetPasswordButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  function copyPassword() {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    toast.success("Passord kopiert");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setPassword(null);
      setCopied(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="min-h-10 rounded-xl font-bold"
          >
            <KeyRound className="size-4" />
            Nullstill passord
          </Button>
        }
      />
      <DialogContent className="rounded-2xl border-[#E3DED3] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nullstill passord</DialogTitle>
          <DialogDescription>{email}</DialogDescription>
        </DialogHeader>
        {password ? (
          <div
            className="grid gap-3 rounded-xl bg-[#F0F8F1] p-4 ring-1 ring-[#B7D7BA]"
            aria-live="polite"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
              <KeyRound aria-hidden="true" className="size-5" />
            </span>
            <Label>Nytt passord</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={password}
                className="min-h-11 rounded-xl bg-white font-mono shadow-none"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Kopier passord"
                title="Kopier passord"
                onClick={copyPassword}
                className="size-11 rounded-xl bg-white"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Kopier passordet nå. Det vises kun denne ene gangen.
            </p>
          </div>
        ) : (
          <div className="flex gap-3 rounded-xl bg-[#FFF8E9] p-4 text-[#775108] ring-1 ring-[#E7CA91]">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" />
            <p className="text-sm">
              Det nåværende passordet slutter å virke med en gang. Del det nye
              passordet med brukeren på en trygg måte.
            </p>
          </div>
        )}
        <DialogFooter>
          {password ? (
            <DialogClose
              render={
                <Button className="min-h-11 rounded-xl px-5 font-bold">
                  Ferdig
                </Button>
              }
            />
          ) : (
            <>
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 rounded-xl px-4 font-bold"
                  >
                    Avbryt
                  </Button>
                }
              />
              <Button
                onClick={handleReset}
                disabled={pending}
                className="min-h-11 rounded-xl px-5 font-bold"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Generer nytt passord
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
