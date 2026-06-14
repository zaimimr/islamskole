import { getTranslations } from "next-intl/server";
import {
  MailIcon,
  MapPinIcon,
  ClockIcon,
  SendIcon,
  GlobeIcon,
  CameraIcon,
} from "lucide-react";
import { getSiteSettings } from "@/lib/data";

type ContactCardProps = {
  showSummary?: boolean;
};

export async function ContactCard({ showSummary = false }: ContactCardProps) {
  const t = await getTranslations("contact");
  const settings = await getSiteSettings();

  const email = settings?.contact_email ?? "baerum@islamskole.no";
  const enrollEmail = settings?.enroll_email ?? "opptak@islamskole.no";
  const address = settings?.address ?? t("addressValue");
  const hours = settings?.hours ?? t("hoursValue");
  const facebook = settings?.facebook_url ?? null;
  const instagram = settings?.instagram_url ?? null;

  const rows = [
    { icon: MailIcon, label: t("email"), value: email, href: `mailto:${email}` },
    {
      icon: SendIcon,
      label: t("enrollEmail"),
      value: enrollEmail,
      href: `mailto:${enrollEmail}`,
    },
    { icon: MapPinIcon, label: t("address"), value: address, href: null },
    { icon: ClockIcon, label: t("hours"), value: hours, href: null },
  ];

  return (
    <div className="soft-card flex flex-col gap-1 p-7 sm:p-9">
      {showSummary && (
        <h2 className="mb-4 text-2xl font-bold">{t("writeUs")}</h2>
      )}
      <ul className="flex flex-col divide-y divide-foreground/8">
        {rows.map(({ icon: Icon, label, value, href }) => (
          <li key={label} className="flex items-start gap-4 py-4">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-brand-green-dark">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {label}
              </span>
              {href ? (
                <a
                  href={href}
                  className="text-lg font-semibold text-foreground hover:text-brand-green-dark focus-visible:underline outline-none"
                >
                  {value}
                </a>
              ) : (
                <span className="text-lg font-semibold text-foreground">
                  {value}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {(facebook || instagram) && (
        <div className="mt-4 flex items-center gap-3 border-t border-foreground/8 pt-5">
          <span className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t("social")}
          </span>
          {facebook && (
            <a
              href={facebook}
              target="_blank"
              rel="noreferrer"
              aria-label={t("facebook")}
              className="inline-flex size-10 items-center justify-center rounded-full bg-primary/12 text-brand-green-dark transition-colors hover:bg-primary/20 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
            >
              <GlobeIcon className="size-5" aria-hidden="true" />
            </a>
          )}
          {instagram && (
            <a
              href={instagram}
              target="_blank"
              rel="noreferrer"
              aria-label={t("instagram")}
              className="inline-flex size-10 items-center justify-center rounded-full bg-primary/12 text-brand-green-dark transition-colors hover:bg-primary/20 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
            >
              <CameraIcon className="size-5" aria-hidden="true" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
