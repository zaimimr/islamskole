import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
});

const nunito = Nunito({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Siden finnes ikke · Islamskole Bærum",
};

export default function GlobalNotFound() {
  return (
    <html
      lang="no"
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <main className="flex min-h-dvh flex-col items-center justify-center gap-7 px-6 py-16 text-center">
          <Link href="/" aria-label="Islamskole Bærum">
            <Image
              src="/brand/logo.png"
              alt="Islamskole Bærum"
              width={180}
              height={64}
              className="h-11 w-auto"
              priority
            />
          </Link>
          <Image
            src="/brand/not-found.png"
            alt="Illustrasjon av et barn som leter etter veien"
            width={360}
            height={360}
            priority
            unoptimized
            className="h-auto w-full max-w-xs"
          />
          <span className="eyebrow">Feil 404</span>
          <h1 className="text-3xl font-bold text-balance-pretty sm:text-4xl">
            Denne siden finnes ikke
          </h1>
          <p className="max-w-md text-lg text-foreground/75 text-balance-pretty">
            Vi fant ikke siden du lette etter. Den kan ha blitt flyttet, fjernet,
            eller lenken kan være feil.
          </p>
          <Link href="/" className="btn-pill-primary">
            Til forsiden
          </Link>
        </main>
      </body>
    </html>
  );
}
