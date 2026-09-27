"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section
      role="alert"
      aria-labelledby="admin-error-title"
      className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-6 ring-1 ring-[#E3DED3] sm:p-8"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-[#F9DEDB] text-[#8B2F2B]">
        <AlertTriangle aria-hidden="true" className="size-5" />
      </span>
      <h1
        id="admin-error-title"
        className="mt-4 text-balance font-heading text-2xl font-bold tracking-[-0.02em] sm:text-3xl"
      >
        Siden kunne ikke vises
      </h1>
      <p className="mt-2 max-w-prose text-admin-muted">
        Noe gikk galt da siden skulle lastes. Ingen opplysninger er slettet.
        Prøv igjen, eller gå tilbake til arbeidsflaten. Hvis du er logget ut,
        logg inn på nytt i en ny fane først.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-admin-action px-4 text-sm font-bold text-white outline-none transition-colors hover:bg-[#245E2B] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <RotateCw aria-hidden="true" className="size-4" />
          Prøv igjen
        </button>
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#DCD7CC] bg-white px-4 text-sm font-bold outline-none transition-colors hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Til arbeidsflaten
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-6 text-xs text-admin-muted">
          Feilkode: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </section>
  );
}
