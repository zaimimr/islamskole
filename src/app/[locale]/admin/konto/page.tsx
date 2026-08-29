import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ChangePasswordForm } from "@/components/admin/change-password-form";

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
          Se hvilken konto du bruker og hold innloggingen sikker.
        </p>
      </header>

      <div className="grid max-w-4xl items-start gap-5 lg:grid-cols-[minmax(16rem,0.72fr)_minmax(0,1.28fr)]">
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

        <section className="rounded-2xl bg-white p-5 ring-1 ring-[#E3DED3] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FEEDCA] text-[#775108]">
              <KeyRound aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="font-heading text-xl font-bold">Endre passord</h2>
              <p className="mt-0.5 text-sm text-admin-muted">
                Velg et nytt passord som ikke brukes på andre tjenester.
              </p>
            </div>
          </div>
          <div className="mt-5 border-t border-[#ECE8DF] pt-5">
            <ChangePasswordForm />
          </div>
        </section>
      </div>
    </div>
  );
}
