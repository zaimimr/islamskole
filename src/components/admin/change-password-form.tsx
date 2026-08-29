"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { changeOwnPassword } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await changeOwnPassword(formData);
      if (result.ok) {
        toast.success("Passordet er endret");
        formRef.current?.reset();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="grid max-w-md gap-5">
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
      <div className="grid gap-2">
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
      <Button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full sm:w-fit"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Lagre nytt passord
      </Button>
    </form>
  );
}
