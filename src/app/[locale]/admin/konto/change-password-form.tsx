"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { changeOwnPassword } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await changeOwnPassword(formData);
      if (result.ok) {
        setError(null);
        toast.success("Passordet er endret");
        formRef.current?.reset();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid max-w-md gap-5">
      <div className="rounded-xl bg-[#F7F6F1] p-4">
        <p className="font-bold">Krav til nytt passord</p>
        <p className="mt-1 flex gap-2 text-sm text-admin-muted">
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-[#3C8F44]"
          />
          Minst 8 tegn. Bruk gjerne flere ord eller en lang passfrase.
        </p>
      </div>
      {error ? (
        <p
          role="alert"
          className="flex gap-2 rounded-xl bg-[#FBEDEB] p-3 text-sm font-semibold text-[#8B2F2B]"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          {error}
        </p>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="current_password" required>
          Nåværende passord
        </Label>
        <Input
          id="current_password"
          name="current_password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="grid gap-2 border-t border-[#ECE8DF] pt-5">
        <Label htmlFor="password" required>
          Nytt passord
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm" required>
          Gjenta nytt passord
        </Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-fit">
        {pending ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : null}
        Lagre nytt passord
      </Button>
    </form>
  );
}
