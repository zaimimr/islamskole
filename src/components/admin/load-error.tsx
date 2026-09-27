import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

export function LoadError({
  title,
  description = "Opplysningene er ikke slettet. Prøv igjen om litt, og ikke gjør endringer før siden laster riktig.",
  retryHref,
  headingLevel = "h1",
}: {
  title: string;
  description?: string;
  retryHref: string;
  headingLevel?: "h1" | "h2";
}) {
  const Heading = headingLevel;
  return (
    <section
      role="alert"
      className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-6 ring-1 ring-[#E3DED3]"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-[#F9DEDB] text-[#8B2F2B]">
        <AlertTriangle aria-hidden="true" className="size-5" />
      </span>
      <Heading className="mt-4 text-balance font-heading text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
        {title}
      </Heading>
      <p className="mt-2 max-w-prose text-admin-muted">{description}</p>
      <Link
        href={retryHref}
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-admin-action px-4 text-sm font-bold text-white outline-none transition-colors hover:bg-[#245E2B] focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <RotateCw aria-hidden="true" className="size-4" />
        Prøv igjen
      </Link>
    </section>
  );
}
