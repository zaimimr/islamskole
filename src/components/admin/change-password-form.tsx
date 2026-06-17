"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
    <form ref={formRef} action={handleSubmit} className="grid max-w-sm gap-4">
      <div className="grid gap-2">
        <Label htmlFor="password" required>Nytt passord</Label>
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
        <Label htmlFor="confirm" required>Gjenta nytt passord</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Lagre nytt passord
      </Button>
    </form>
  );
}
