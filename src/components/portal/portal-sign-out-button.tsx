"use client";

import { useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { signOutPortal } from "@/lib/portal/actions";
import { Button } from "@/components/ui/button";

export function PortalSignOutButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await signOutPortal();
      router.replace("/min-side/logg-inn");
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? (
        <Loader2 aria-hidden="true" className="animate-spin" />
      ) : (
        <LogOut aria-hidden="true" />
      )}
      {label}
    </Button>
  );
}
