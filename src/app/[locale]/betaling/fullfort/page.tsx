import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/site/PageHeader";
import { Section } from "@/components/site/Section";
import { buttonVariants } from "@/components/ui/button";

type Copy = { title: string; body: string };

const messages: Record<string, Record<"no" | "en", Copy>> = {
  fanget: {
    no: {
      title: "Takk for betalingen",
      body: "Betalingen er gjennomført. Du vil få en bekreftelse fra skolen.",
    },
    en: {
      title: "Thank you for your payment",
      body: "Your payment is complete. The school will confirm your enrolment.",
    },
  },
  autorisert: {
    no: {
      title: "Betaling mottatt",
      body: "Betalingen er godkjent og blir behandlet av skolen.",
    },
    en: {
      title: "Payment received",
      body: "Your payment is authorised and will be processed by the school.",
    },
  },
  avbrutt: {
    no: {
      title: "Betalingen ble avbrutt",
      body: "Betalingen ble ikke fullført. Ta kontakt med skolen om du trenger hjelp.",
    },
    en: {
      title: "Payment cancelled",
      body: "The payment was not completed. Contact the school if you need help.",
    },
  },
  ukjent: {
    no: {
      title: "Status er ukjent",
      body: "Vi klarte ikke å bekrefte betalingen nå. Ta kontakt med skolen.",
    },
    en: {
      title: "Unknown status",
      body: "We could not confirm the payment right now. Please contact the school.",
    },
  },
};

export default async function PaymentDonePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const state = typeof sp.state === "string" ? sp.state : "ukjent";
  const lang = locale === "en" ? "en" : "no";
  const copy = (messages[state] ?? messages.ukjent)[lang];

  return (
    <>
      <PageHeader eyebrow="Vipps" title={copy.title} subtitle={copy.body} />
      <Section className="bg-card">
        <Link href="/" className={buttonVariants()}>
          {lang === "en" ? "Back to home" : "Til forsiden"}
        </Link>
      </Section>
    </>
  );
}
