"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldPlus } from "lucide-react";
import { grantAdminAccess } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GrantAdminForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(grantAdminAccess, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success("Administratortilgang gitt. Innloggingslenken er sendt.");
    else toast.error(state.error);
    router.refresh();
  }, [state, router]);

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] sm:p-5">
      <form
        action={formAction}
        aria-labelledby="grant-admin-title"
        className="grid gap-4"
      >
        <div>
          <h2 id="grant-admin-title" className="font-heading text-xl font-bold">
            Gi administratortilgang
          </h2>
          <p className="mt-0.5 text-sm text-admin-muted">
            Virker både for nye personer og for foreldre eller lærere som
            allerede logger inn på Min side. Personen får en innloggingslenke
            på e-post.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor="grant-full-name">Navn</Label>
            <Input
              id="grant-full-name"
              name="full_name"
              placeholder="Fullt navn"
              autoComplete="off"
              className="shadow-none"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="grant-email" required>
              E-post
            </Label>
            <Input
              id="grant-email"
              name="email"
              type="email"
              required
              placeholder="navn@eksempel.no"
              autoComplete="off"
              spellCheck={false}
              className="shadow-none"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <ShieldPlus aria-hidden="true" className="size-4" />
            )}
            Gi tilgang
          </Button>
        </div>
      </form>
    </section>
  );
}
