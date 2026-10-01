import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  BookOpenTextIcon,
  CalendarSyncIcon,
  HouseIcon,
  SmartphoneIcon,
  UsersRoundIcon,
} from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { Section } from "@/components/site/Section";
import {
  DONATION_EMAIL,
  VIPPS_NUMBER,
  VippsDonateButton,
} from "@/components/site/VippsDonateButton";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/donasjon">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "donate" });
  return { title: t("title"), description: t("metaDescription") };
}

type Fund = { title: string; body: string };

const fundIcons = [BookOpenTextIcon, UsersRoundIcon, HouseIcon];

function withEmail(text: string) {
  if (!text.includes("{email}")) return text;
  const [before, after] = text.split("{email}");
  return (
    <>
      {before}
      <a
        href={`mailto:${DONATION_EMAIL}`}
        className="rounded-sm font-semibold text-brand-green-dark underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {DONATION_EMAIL}
      </a>
      {after}
    </>
  );
}

export default async function DonationPage({
  params,
}: PageProps<"/[locale]/donasjon">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("donate");
  const funds = t.raw("funds") as Fund[];
  const terms = t.raw("terms") as string[];

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

      <Section className="bg-card" ariaLabelledby="donate-give-heading">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
          <div className="flex flex-col gap-6">
            <div className="soft-card flex flex-col items-start gap-5 p-7 sm:p-10">
              <h2 id="donate-give-heading" className="text-3xl font-bold text-balance-pretty">
                {t("giveTitle")}
              </h2>
              <p className="text-lg text-muted-foreground text-balance-pretty">{t("giveBody")}</p>
              <VippsDonateButton className="w-full sm:w-auto" />
              <p className="text-sm text-muted-foreground">{t("vippsNote")}</p>
              <div className="flex w-full items-start gap-4 rounded-2xl bg-secondary/45 p-5">
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card text-brand-green-dark">
                  <SmartphoneIcon className="size-6" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
                    {t("numberLabel")}
                  </p>
                  <p className="text-3xl font-bold text-foreground tabular-nums">{VIPPS_NUMBER}</p>
                  <p className="text-base text-muted-foreground">{t("numberBody")}</p>
                </div>
              </div>
            </div>

            <div className="soft-card flex items-start gap-4 p-7 sm:p-8">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-brand-green-dark">
                <CalendarSyncIcon className="size-6" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold">{t("monthlyTitle")}</h2>
                <p className="text-base text-muted-foreground text-balance-pretty">
                  {withEmail(t.raw("monthlyBody") as string)}
                </p>
              </div>
            </div>
          </div>

          <section aria-labelledby="donate-funds-heading" className="flex flex-col gap-5">
            <h2 id="donate-funds-heading" className="text-2xl font-bold">
              {t("fundsTitle")}
            </h2>
            <ul className="flex flex-col gap-4">
              {funds.map((fund, index) => {
                const Icon = fundIcons[index] ?? BookOpenTextIcon;
                return (
                  <li
                    key={fund.title}
                    className="flex items-start gap-4 rounded-3xl bg-background p-6 ring-1 ring-foreground/8"
                  >
                    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-brand-green-dark">
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-base font-bold">{fund.title}</h3>
                      <p className="text-sm text-muted-foreground text-balance-pretty">{fund.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <section aria-labelledby="donate-terms-heading" className="mt-14 max-w-3xl border-t border-foreground/8 pt-10">
          <h2 id="donate-terms-heading" className="text-2xl font-bold">
            {t("termsTitle")}
          </h2>
          <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-base text-muted-foreground marker:text-primary">
            {terms.map((term) => (
              <li key={term}>{withEmail(term)}</li>
            ))}
          </ul>
        </section>
      </Section>
    </>
  );
}
