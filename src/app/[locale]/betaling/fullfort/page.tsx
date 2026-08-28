import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import {
  Check,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Mail,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { Section } from "@/components/site/Section";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type State = "fanget" | "autorisert" | "avbrutt" | "ukjent";

type Copy = {
  title: string;
  body: string;
  status: string;
  nextTitle: string;
  steps: [string, string, string];
  support: string;
  home: string;
  contact: string;
};

const messages: Record<State, Record<"no" | "en", Copy>> = {
  fanget: {
    no: {
      title: "Betalingen er gjennomført",
      body: "Innmeldingen er registrert, og beløpet er trukket i Vipps.",
      status: "Betalt",
      nextTitle: "Dette skjer videre",
      steps: [
        "Du mottar betalingsbekreftelse fra Vipps.",
        "Skolen gjennomgår innmeldingen og familieopplysningene.",
        "Skolen tar kontakt om klasseplassering og oppstart.",
      ],
      support:
        "Betalingen bekrefter innmeldingen, men ikke en bestemt klasseplass.",
      home: "Til forsiden",
      contact: "Kontakt skolen",
    },
    en: {
      title: "Payment completed",
      body: "The enrollment is registered and the amount has been charged in Vipps.",
      status: "Paid",
      nextTitle: "What happens next",
      steps: [
        "You receive a payment confirmation from Vipps.",
        "The school reviews the enrollment and family information.",
        "The school contacts you about class placement and the start date.",
      ],
      support:
        "Payment confirms the enrollment, but not a specific class placement.",
      home: "Back to home",
      contact: "Contact the school",
    },
  },
  autorisert: {
    no: {
      title: "Betalingen er godkjent",
      body: "Vipps har godkjent betalingen. Skolen kontrollerer at beløpet blir registrert.",
      status: "Godkjent i Vipps",
      nextTitle: "Dette skjer videre",
      steps: [
        "Vipps fullfører behandlingen av betalingen.",
        "Skolen kontrollerer betalingsstatusen.",
        "Skolen tar kontakt om innmelding og klasseplassering.",
      ],
      support: "Du trenger ikke betale på nytt mens statusen behandles.",
      home: "Til forsiden",
      contact: "Kontakt skolen",
    },
    en: {
      title: "Payment approved",
      body: "Vipps approved the payment. The school is checking that the amount is registered.",
      status: "Approved in Vipps",
      nextTitle: "What happens next",
      steps: [
        "Vipps completes payment processing.",
        "The school checks the payment status.",
        "The school contacts you about enrollment and class placement.",
      ],
      support:
        "You do not need to pay again while the status is being processed.",
      home: "Back to home",
      contact: "Contact the school",
    },
  },
  avbrutt: {
    no: {
      title: "Betalingen ble avbrutt",
      body: "Vipps-belastningen ble ikke fullført.",
      status: "Ikke betalt",
      nextTitle: "Slik går du videre",
      steps: [
        "Kontroller Vipps for å se at beløpet ikke er trukket.",
        "Start innmeldingen på nytt når du er klar.",
        "Kontakt skolen hvis du er usikker på betalingsstatusen.",
      ],
      support: "Skolen har ikke registrert en fullført betaling.",
      home: "Til forsiden",
      contact: "Kontakt skolen",
    },
    en: {
      title: "Payment cancelled",
      body: "The Vipps charge was not completed.",
      status: "Not paid",
      nextTitle: "How to continue",
      steps: [
        "Check Vipps to confirm that the amount was not charged.",
        "Start the enrollment again when you are ready.",
        "Contact the school if you are unsure about the payment status.",
      ],
      support: "The school has not registered a completed payment.",
      home: "Back to home",
      contact: "Contact the school",
    },
  },
  ukjent: {
    no: {
      title: "Vi kontrollerer betalingen",
      body: "Vi kunne ikke bekrefte den endelige betalingsstatusen akkurat nå.",
      status: "Kontroll pågår",
      nextTitle: "Dette bør du gjøre",
      steps: [
        "Kontroller i Vipps om beløpet er trukket.",
        "Ikke gjennomfør en ny betaling med en gang.",
        "Kontakt skolen hvis statusen ikke er avklart innen kort tid.",
      ],
      support:
        "Skolen kan kontrollere betalingen mot Vipps før du eventuelt prøver igjen.",
      home: "Til forsiden",
      contact: "Kontakt skolen",
    },
    en: {
      title: "We are checking the payment",
      body: "We could not confirm the final payment status right now.",
      status: "Check in progress",
      nextTitle: "What you should do",
      steps: [
        "Check Vipps to see whether the amount was charged.",
        "Do not make another payment immediately.",
        "Contact the school if the status is not clarified shortly.",
      ],
      support:
        "The school can check the payment against Vipps before you try again.",
      home: "Back to home",
      contact: "Contact the school",
    },
  },
};

const stateStyles: Record<
  State,
  { icon: typeof CheckCircle2; tone: string; badge: string }
> = {
  fanget: {
    icon: CheckCircle2,
    tone: "bg-primary/10 text-brand-green-dark",
    badge: "bg-primary/12 text-brand-green-dark",
  },
  autorisert: {
    icon: Clock3,
    tone: "bg-accent text-accent-foreground",
    badge: "bg-accent text-accent-foreground",
  },
  avbrutt: {
    icon: XCircle,
    tone: "bg-destructive/10 text-destructive",
    badge: "bg-destructive/10 text-destructive",
  },
  ukjent: {
    icon: HelpCircle,
    tone: "bg-secondary text-secondary-foreground",
    badge: "bg-secondary text-secondary-foreground",
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
  const search = await searchParams;
  const requestedState =
    typeof search.state === "string" ? search.state : "ukjent";
  const state: State =
    requestedState in messages ? (requestedState as State) : "ukjent";
  const language = locale === "en" ? "en" : "no";
  const copy = messages[state][language];
  const style = stateStyles[state];
  const StatusIcon = style.icon;

  return (
    <>
      <PageHeader
        eyebrow="Vipps"
        title={copy.title}
        subtitle={copy.body}
        compact
      />
      <Section className="py-12 sm:py-16">
        <div className="mx-auto grid max-w-3xl gap-6">
          <div className="rounded-3xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
            <div className="flex flex-col gap-5 border-b border-foreground/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span
                  className={cn(
                    "inline-flex size-12 items-center justify-center rounded-2xl",
                    style.tone,
                  )}
                >
                  <StatusIcon className="size-6" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm text-muted-foreground">Vipps</p>
                  <p className="font-heading text-xl font-bold">
                    {copy.status}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "w-fit rounded-full px-3 py-1 text-sm font-bold",
                  style.badge,
                )}
              >
                {copy.status}
              </span>
            </div>

            <h2 className="mt-7 font-heading text-2xl font-bold">
              {copy.nextTitle}
            </h2>
            <ol className="mt-5 grid gap-4">
              {copy.steps.map((item, index) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-brand-green-dark">
                    {state === "fanget" && index === 0 ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <p className="pt-0.5 text-sm leading-6 text-foreground">
                    {item}
                  </p>
                </li>
              ))}
            </ol>

            <div className="mt-7 flex items-start gap-3 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
              <Mail
                className="mt-0.5 size-5 shrink-0 text-brand-green-dark"
                aria-hidden="true"
              />
              <p>{copy.support}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/" className={cn(buttonVariants(), "min-h-12 px-6")}>
              {copy.home}
            </Link>
            <Link
              href="/kontakt"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "min-h-12 px-6",
              )}
            >
              {copy.contact}
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
