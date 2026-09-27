import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export default function PortalNotFound() {
  const t = useTranslations("portal.notFound");

  return (
    <div className="soft-card grid gap-4 p-6 sm:p-8">
      <h1 className="font-heading text-2xl font-semibold text-balance">{t("title")}</h1>
      <p className="text-pretty text-muted-foreground">{t("text")}</p>
      <Link href="/min-side" className={buttonVariants({ className: "w-fit" })}>
        <ArrowLeft aria-hidden="true" />
        {t("back")}
      </Link>
    </div>
  );
}
