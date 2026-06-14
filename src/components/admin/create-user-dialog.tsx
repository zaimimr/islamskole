"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus, Copy, Check } from "lucide-react";
import { createUser } from "@/app/[locale]/admin/actions";
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

export function CreateUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<{ email: string; password: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createUser(formData);
      if (result.ok) {
        setCreated({ email: result.email ?? "", password: result.password });
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function copyPassword() {
    if (!created) return;
    navigator.clipboard.writeText(created.password);
    setCopied(true);
    toast.success("Passord kopiert");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setCreated(null);
      setCopied(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button>
            <UserPlus className="size-4" />
            Ny bruker
          </Button>
        }
      />
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Bruker opprettet</DialogTitle>
              <DialogDescription>
                Kopier passordet nå. Det vises kun denne ene gangen.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label>Brukernavn</Label>
                <Input readOnly value={created.email} />
              </div>
              <div className="grid gap-1">
                <Label>Midlertidig passord</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={created.password}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyPassword}
                  >
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button>Ferdig</Button>} />
            </DialogFooter>
          </>
        ) : (
          <form action={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Ny bruker</DialogTitle>
              <DialogDescription>
                Brukeren får et automatisk generert passord som vises etterpå.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Brukernavn (e-post)</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="navn@islamskole.no"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="full_name">Navn</Label>
                <Input id="full_name" name="full_name" placeholder="Fullt navn" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Opprett bruker
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
