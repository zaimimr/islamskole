import { getTranslations } from "next-intl/server";
import { HeartHandshakeIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const VIPPS_DONATION_URL = "https://qr.vipps.no/donations/60206";
export const VIPPS_NUMBER = "24279";
export const DONATION_EMAIL = "donasjon@islamskole.no";

export async function VippsDonateButton({
  tone = "primary",
  className,
}: {
  tone?: "primary" | "cream";
  className?: string;
}) {
  const t = await getTranslations("donate");

  return (
    <a
      href={VIPPS_DONATION_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        tone === "cream" ? "btn-pill-cream" : "btn-pill-primary",
        "min-h-14 px-8 text-lg",
        className,
      )}
    >
      <HeartHandshakeIcon className="size-5" aria-hidden="true" />
      {t("vippsCta")}
      <span className="sr-only"> {t("newTab")}</span>
    </a>
  );
}
