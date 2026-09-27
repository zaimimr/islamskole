"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { adminBasePath, loginPath } from "@/components/admin/paths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status = "checking" | "ready" | "invalid";

export default function NyttPassordPage({
  params,
}: PageProps<"/[locale]/login/nytt-passord">) {
  const { locale } = use(params);
  const [status, setStatus] = useState<Status>("checking");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let recovered = false;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const auth = createClient().auth;
    const { data: listener } = auth.onAuthStateChange((event) => {
      if (event !== "PASSWORD_RECOVERY") return;
      recovered = true;
      if (active) setStatus("ready");
    });
    const settle = () => {
      fallback = setTimeout(() => {
        if (active && !recovered) setStatus("invalid");
      }, 500);
    };
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const check =
      tokenHash && params.get("type") === "recovery"
        ? auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
        : auth.getSession();
    check.then(settle, settle);
    return () => {
      active = false;
      if (fallback) clearTimeout(fallback);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (password.length < 8) {
      setError("Passordet må ha minst 8 tegn.");
      return;
    }
    if (password !== confirm) {
      setError("Passordene er ikke like.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: updateError } = await createClient().auth.updateUser({
      password,
    });
    if (updateError) {
      setError(
        updateError.code === "same_password"
          ? "Det nye passordet må være forskjellig fra det gamle."
          : "Passordet kunne ikke lagres. Be om en ny lenke og prøv igjen.",
      );
      setPending(false);
      return;
    }
    window.location.assign(adminBasePath(locale));
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 ring-1 ring-[#E3DED3] sm:p-8">
      <div className="flex flex-col items-center text-center">
        <Image
          src="/brand/logo.png"
          alt="Islamskole Bærum"
          width={180}
          height={64}
          className="mb-4 h-auto w-36"
          priority
        />
        <h1 className="font-heading text-2xl font-bold">Velg nytt passord</h1>
      </div>

      {status === "checking" ? (
        <p
          role="status"
          className="mt-6 flex items-center justify-center gap-2 text-sm text-admin-muted"
        >
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Sjekker lenken …
        </p>
      ) : null}

      {status === "invalid" ? (
        <div className="mt-6 grid gap-4">
          <p
            role="alert"
            className="flex gap-2 rounded-xl bg-[#FFF8E9] p-4 text-sm text-[#5E4108] ring-1 ring-[#E7CA91]"
          >
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            Lenken er utløpt eller allerede brukt. Be om en ny lenke fra
            innloggingssiden, og åpne den i samme nettleser som du ba om den
            fra.
          </p>
          <Link
            href={loginPath(locale)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-admin-action px-4 text-sm font-bold text-white outline-none hover:bg-[#245E2B] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Til innlogging
          </Link>
        </div>
      ) : null}

      {status === "ready" ? (
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
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
            <Label htmlFor="password" required>
              Nytt passord
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p className="text-sm text-admin-muted">Minst 8 tegn.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm" required>
              Gjenta nytt passord
            </Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            Lagre og logg inn
          </Button>
        </form>
      ) : null}
    </div>
  );
}
