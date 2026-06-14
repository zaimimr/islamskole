import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { getUser } from "@/lib/auth";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import {
  siteUrl,
  siteName,
  keywordsFor,
  defaultDescription,
  localePath,
  organizationJsonLd,
} from "@/lib/seo";
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

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const typedLocale = (hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale) as Locale;
  const description = defaultDescription(typedLocale);
  const path = localePath(typedLocale);

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${siteName} - islamsk søndagsskole for barn i Bærum`,
      template: `%s · ${siteName}`,
    },
    description,
    keywords: keywordsFor(typedLocale),
    applicationName: siteName,
    authors: [{ name: siteName }],
    category: "education",
    alternates: {
      canonical: path,
      languages: {
        no: localePath("no"),
        en: localePath("en"),
        "x-default": localePath("no"),
      },
    },
    openGraph: {
      type: "website",
      siteName,
      locale: typedLocale === "no" ? "nb_NO" : "en_US",
      url: `${siteUrl}${path}`,
      title: `${siteName} - islamsk søndagsskole for barn i Bærum`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: siteName,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
  };
}

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
  const t = await getTranslations("nav");
  const user = await getUser();

  return (
    <html
      lang={locale}
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              organizationJsonLd(
                (hasLocale(routing.locales, locale)
                  ? locale
                  : routing.defaultLocale) as Locale,
              ),
            ),
          }}
        />
        <NextIntlClientProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-foreground"
          >
            {t("skipToContent")}
          </a>
          <SiteHeader />
          <main id="main-content" className="flex flex-1 flex-col">
            {children}
          </main>
          <SiteFooter isLoggedIn={Boolean(user)} />
          <Toaster richColors position="top-center" />
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
