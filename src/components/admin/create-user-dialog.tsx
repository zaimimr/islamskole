"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Loader2, ShieldCheck, UserPlus } from "lucide-react";
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
  const [created, setCreated] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
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

  async function copyPassword() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.password);
      setCopied(true);
      toast.success("Passord kopiert");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kunne ikke kopiere. Marker passordet og kopier det selv.");
    }
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
            <UserPlus aria-hidden="true" className="size-4" />
            Ny bruker
          </Button>
        }
      />
      <DialogContent className="rounded-2xl border-[#E3DED3] sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Bruker opprettet</DialogTitle>
              <DialogDescription>
                Kopier passordet nå. Det vises bare denne ene gangen. Be
                brukeren bytte det under Min konto etter første innlogging.
              </DialogDescription>
            </DialogHeader>
            <div
              className="grid gap-4 rounded-xl bg-[#F0F8F1] p-4 ring-1 ring-[#B7D7BA]"
              aria-live="polite"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
                <ShieldCheck aria-hidden="true" className="size-5" />
              </span>
              <div className="grid gap-1">
                <Label>Brukernavn</Label>
                <Input
                  readOnly
                  value={created.email}
                  className="bg-white shadow-none"
                />
              </div>
              <div className="grid gap-1">
                <Label>Midlertidig passord</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={created.password}
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
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <DialogClose render={<Button>Ferdig</Button>} />
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Ny bruker</DialogTitle>
              <DialogDescription>
                Brukeren får et automatisk generert passord som vises etterpå.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 rounded-xl bg-[#F8F6F0] p-4">
              <div className="grid gap-2">
                <Label htmlFor="email" required>
                  Brukernavn (e-post)
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="navn@islamskole.no"
                  autoComplete="off"
                  spellCheck={false}
                  className="bg-white shadow-none"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="full_name">Navn</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  placeholder="Fullt navn"
                  autoComplete="off"
                  className="bg-white shadow-none"
                />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <DialogClose
                render={
                  <Button type="button" variant="outline">
                    Avbryt
                  </Button>
                }
              />
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
