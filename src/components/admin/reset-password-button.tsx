"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound, Copy, Check } from "lucide-react";
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
          <Button variant="outline" size="sm">
            <KeyRound className="size-4" />
            Nullstill passord
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nullstill passord</DialogTitle>
          <DialogDescription>{email}</DialogDescription>
        </DialogHeader>
        {password ? (
          <div className="grid gap-1">
            <Label>Nytt passord</Label>
            <div className="flex gap-2">
              <Input readOnly value={password} className="font-mono" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Kopier passord"
                title="Kopier passord"
                onClick={copyPassword}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Kopier passordet nå. Det vises kun denne ene gangen.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Dette lager et nytt midlertidig passord for brukeren.
          </p>
        )}
        <DialogFooter>
          {password ? (
            <DialogClose render={<Button>Ferdig</Button>} />
          ) : (
            <Button onClick={handleReset} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Generer nytt passord
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
