"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { sendLoginLinkToGuardian } from "@/app/[locale]/admin/portal-admin-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SendLoginLinkButton({
  guardianId,
  email,
  className,
}: {
  guardianId: string;
  email: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const result = await sendLoginLinkToGuardian(guardianId);
      if (result.ok) toast.success(`Innloggingslenke sendt til ${email}`);
      else toast.error(result.error);
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={send}
      aria-label={`Send innloggingslenke til ${email}`}
      className={cn("min-h-11 rounded-xl bg-white px-3 font-bold", className)}
    >
      {pending ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <KeyRound aria-hidden="true" className="size-4" />
      )}
      Send innloggingslenke
    </Button>
  );
}
