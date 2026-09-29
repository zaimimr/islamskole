import type { Metadata } from "next";
import { Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Min konto" };

async function getEmail() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email ?? "-";
  } catch {
    return "-";
  }
}

export default async function KontoPage() {
  const email = await getEmail();

  return (
    <div className="grid gap-6 lg:gap-7">
      <header>
        <h1 className="text-balance font-heading text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
          Min konto
        </h1>
        <p className="mt-1 max-w-2xl text-admin-muted">
          Se hvilken konto du bruker. Du logger inn med en lenke vi sender til e-posten din, uten passord.
        </p>
      </header>

      <div className="grid max-w-md items-start gap-5">
        <aside className="rounded-2xl bg-white p-5 ring-1 ring-[#E3DED3] sm:p-6">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
            <ShieldCheck aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-4 font-heading text-xl font-bold">
            Administratorkonto
          </h2>
          <p className="mt-1 text-sm text-admin-muted">
            Denne kontoen har tilgang til skolens administrative opplysninger.
          </p>

          <dl className="mt-5 border-t border-[#ECE8DF] pt-5">
            <div className="flex items-start gap-3">
              <Mail
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-[#3C8F44]"
              />
              <div className="min-w-0">
                <dt className="text-xs text-admin-muted">Innlogget som</dt>
                <dd className="mt-0.5 break-words font-bold">{email}</dd>
              </div>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
