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
      <DialogContent className="rounded-2xl border-[#E3DED3] sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Bruker opprettet</DialogTitle>
              <DialogDescription>
                Kopier passordet nå. Det vises kun denne ene gangen.
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
                  className="min-h-11 rounded-xl bg-white shadow-none"
                />
              </div>
              <div className="grid gap-1">
                <Label>Midlertidig passord</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={created.password}
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
              </div>
            </div>
            <DialogFooter className="pt-2">
              <DialogClose
                render={
                  <Button className="min-h-11 rounded-xl px-5 font-bold">
                    Ferdig
                  </Button>
                }
              />
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
                  className="min-h-11 rounded-xl bg-white shadow-none"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="full_name">Navn</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  placeholder="Fullt navn"
                  autoComplete="off"
                  className="min-h-11 rounded-xl bg-white shadow-none"
                />
              </div>
            </div>
            <DialogFooter className="pt-4">
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
                type="submit"
                disabled={pending}
                className="min-h-11 rounded-xl px-5 font-bold"
              >
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
