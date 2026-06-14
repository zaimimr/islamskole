import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Toaster } from "@/components/ui/sonner";
import "../globals.css";

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
  title: {
    default: "Islamskole Bærum",
    template: "%s · Islamskole Bærum",
  },
  description:
    "Søndagsskole for muslimske barn i Bærum. Islam, Koran og arabisk i et trygt og lekent miljø.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider>
          {children}
          <Toaster richColors position="top-center" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
