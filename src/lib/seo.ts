import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
  "http://localhost:3000"
).replace(/\/$/, "");

export const siteName = "Islamskole Bærum";

const keywords: Record<Locale, string[]> = {
  no: [
    "islamskole",
    "islamskole Bærum",
    "islamsk søndagsskole",
    "søndagsskole Bærum",
    "koranskole Bærum",
    "koranundervisning for barn",
    "arabisk for barn",
    "lære koranen",
    "islamundervisning barn",
    "muslimsk skole Bærum",
    "islamsk skole Akershus",
    "muslimske barn fellesskap",
    "barn lærer om islam",
    "Vøyenenga",
    "Eid feiring Bærum",
    "bli lærer islamskole",
    "frivillig lærer koranskole",
  ],
  en: [
    "Islamic Sunday school",
    "Islamic school Bærum",
    "Quran school for children",
    "Arabic for kids",
    "Muslim school Bærum Norway",
    "Islamic education for children",
    "learn the Quran",
    "Muslim children community Norway",
    "weekend Islamic school Oslo Bærum",
    "become a teacher Islamic school",
  ],
};

const descriptions: Record<Locale, string> = {
  no: "Islamskole Bærum er en islamsk søndagsskole for muslimske barn fra 6 til 18 år. Vi tilbyr koran, arabisk og islamsk kunnskap i et trygt og lekent fellesskap. Påmelding for elever, og bli lærer hos oss.",
  en: "Islamskole Bærum is an Islamic Sunday school for Muslim children aged 6 to 18 in Bærum, Norway. Quran, Arabic and Islamic knowledge in a safe, joyful community. Enroll students or become a teacher.",
};

export function keywordsFor(locale: Locale) {
  return keywords[locale] ?? keywords.no;
}

export function defaultDescription(locale: Locale) {
  return descriptions[locale] ?? descriptions.no;
}

export function localePath(locale: Locale, path = "") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const base = locale === "no" ? "" : "/en";
  const full = `${base}${clean === "/" ? "" : clean}`;
  return full === "" ? "/" : full;
}

export function contentMetadata(opts: {
  locale: Locale;
  title: string;
  description: string;
  basePath: string;
  image?: string | null;
}): Metadata {
  const { locale, title, description, basePath } = opts;
  const canonical = localePath(locale, basePath);

  return {
    title,
    description,
    keywords: keywordsFor(locale),
    alternates: {
      canonical,
      languages: {
        no: localePath("no", basePath),
        en: localePath("en", basePath),
        "x-default": localePath("no", basePath),
      },
    },
    openGraph: {
      type: "article",
      url: `${siteUrl}${canonical}`,
      siteName,
      locale: locale === "no" ? "nb_NO" : "en_US",
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

const schoolAddress = {
  "@type": "PostalAddress",
  streetAddress: "Skuiveien 40",
  postalCode: "1339",
  addressLocality: "Vøyenenga",
  addressRegion: "Bærum",
  addressCountry: "NO",
};

export function eventJsonLd(opts: {
  title: string;
  description: string;
  basePath: string;
  image?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: opts.title,
    description: opts.description || undefined,
    url: `${siteUrl}${localePath("no", opts.basePath)}`,
    image: opts.image ? [opts.image] : [`${siteUrl}/brand/hero.png`],
    startDate: opts.startDate || undefined,
    endDate: opts.endDate || undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: opts.location || siteName,
      address: opts.location || schoolAddress,
    },
    organizer: { "@type": "Organization", name: siteName, url: siteUrl },
  };
}

export function courseJsonLd(opts: {
  name: string;
  description: string;
  basePath: string;
  image?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: opts.name,
    description: opts.description || undefined,
    url: `${siteUrl}${localePath("no", opts.basePath)}`,
    image: opts.image ? [opts.image] : undefined,
    inLanguage: "nb-NO",
    provider: { "@type": "EducationalOrganization", name: siteName, url: siteUrl },
  };
}

export function organizationJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: siteName,
    alternateName: "Islamskole Bærum søndagsskole",
    url: siteUrl,
    logo: `${siteUrl}/brand/logo.png`,
    image: `${siteUrl}/brand/hero.png`,
    description: defaultDescription(locale),
    email: "baerum@islamskole.no",
    foundingLocation: "Bærum, Norge",
    areaServed: ["Bærum", "Vøyenenga", "Sandvika", "Akershus", "Oslo"],
    address: {
      "@type": "PostalAddress",
      streetAddress: "Skuiveien 40",
      postalCode: "1339",
      addressLocality: "Vøyenenga",
      addressRegion: "Bærum",
      addressCountry: "NO",
    },
    audience: {
      "@type": "EducationalAudience",
      educationalRole: "student",
      audienceType: "Muslim children aged 6 to 18 and their parents",
    },
  };
}
