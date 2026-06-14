"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { signOut } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton({ loginHref }: { loginHref: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await signOut();
      router.push(loginHref);
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      className="w-full justify-start"
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <LogOut className="size-4" />
      )}
      Logg ut
    </Button>
  );
}
