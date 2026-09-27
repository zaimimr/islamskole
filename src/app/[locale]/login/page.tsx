"use client";

import { use, useState } from "react";
import Image from "next/image";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { adminBasePath, loginPath } from "@/components/admin/paths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SAFE_NEXT = /^\/(?:no\/)?admin(?:[/?#]|$)/;

function safeNext(value: string | string[] | undefined) {
  if (typeof value !== "string") return null;
  if (value.startsWith("//") || !SAFE_NEXT.test(value)) return null;
  return value;
}

type Mode = "login" | "reset" | "reset-sent";

export default function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const { locale } = use(params);
  const query = use(searchParams);
  const next = safeNext(query.next);
  const [denied, setDenied] = useState(query["ingen-tilgang"] === "1");
  const [mode, setMode] = useState<Mode>("login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    setPending(true);
    setError(null);
    try {
      const { error: signInError } =
        await createClient().auth.signInWithPassword({
          email: email.trim(),
          password,
        });
      if (signInError) {
        setError("Feil e-post eller passord. Sjekk skrivemåten og prøv igjen.");
        setPending(false);
        return;
      }
      window.location.assign(next ?? adminBasePath(locale));
    } catch {
      setError("Noe gikk galt. Sjekk internettforbindelsen og prøv igjen.");
      setPending(false);
    }
  }

  async function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { error: resetError } =
        await createClient().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}${loginPath(locale)}/nytt-passord`,
        });
      if (resetError) {
        setError("Vi kunne ikke sende e-posten nå. Vent litt og prøv igjen.");
        setPending(false);
        return;
      }
      setMode("reset-sent");
    } catch {
      setError("Noe gikk galt. Sjekk internettforbindelsen og prøv igjen.");
    }
    setPending(false);
  }

  async function handleSignOut() {
    setPending(true);
    await createClient().auth.signOut();
    setDenied(false);
    setPending(false);
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
        <h1 className="font-heading text-2xl font-bold">
          {mode === "login" ? "Logg inn" : "Glemt passord"}
        </h1>
        <p className="mt-1 text-sm text-admin-muted">
          {mode === "login"
            ? "Administrasjon for Islamskole Bærum"
            : "Vi sender deg en lenke for å velge nytt passord."}
        </p>
      </div>

      {denied ? (
        <div
          role="alert"
          className="mt-6 grid gap-3 rounded-xl bg-[#FFF8E9] p-4 text-sm text-[#5E4108] ring-1 ring-[#E7CA91]"
        >
          <p className="flex gap-2">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            Kontoen du er logget inn med har ikke tilgang til administrasjonen.
            Logg ut og logg inn med en administratorkonto.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={handleSignOut}
            disabled={pending}
            className="w-full bg-white"
          >
            Logg ut
          </Button>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-6 flex gap-2 rounded-xl bg-[#FBEDEB] p-3 text-sm font-semibold text-[#8B2F2B]"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          {error}
        </p>
      ) : null}

      {mode === "login" ? (
        <form onSubmit={handleLogin} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email" required>
              E-post
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password" required>
                Passord
              </Label>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("reset");
                }}
                className="inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-bold text-[#277A31] underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Glemt passord?
              </button>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            Logg inn
          </Button>
        </form>
      ) : null}

      {mode === "reset" ? (
        <form onSubmit={handleReset} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="reset-email" required>
              E-post
            </Label>
            <Input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            Send lenke
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setError(null);
              setMode("login");
            }}
            className="w-full"
          >
            Tilbake til innlogging
          </Button>
        </form>
      ) : null}

      {mode === "reset-sent" ? (
        <div className="mt-6 grid gap-4">
          <p
            role="status"
            className="flex gap-2 rounded-xl bg-[#F0F8F1] p-4 text-sm text-[#1D4E24] ring-1 ring-[#B7D7BA]"
          >
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            Hvis {email.trim() || "adressen"} har en konto, får du en e-post med
            en lenke i løpet av noen minutter. Sjekk også søppelposten.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setMode("login")}
            className="w-full"
          >
            Tilbake til innlogging
          </Button>
        </div>
      ) : null}
    </div>
  );
}
