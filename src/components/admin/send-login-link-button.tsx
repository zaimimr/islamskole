"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { sendLoginLinkToGuardian } from "@/app/[locale]/admin/portal-admin-actions";
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
    <button
      type="button"
      disabled={pending}
      onClick={send}
      aria-label={`Send innloggingslenke til ${email}`}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-lg text-xs font-semibold text-[#277A31] underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 xl:min-h-8",
        className,
      )}
    >
      {pending ? (
        <Loader2 aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />
      ) : (
        <KeyRound aria-hidden="true" className="size-3.5 shrink-0" />
      )}
      Send innloggingslenke
    </button>
  );
}
