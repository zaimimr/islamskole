import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, HomeIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Blob, DottedArc } from "@/components/site/decor";

export default function NotFoundPage() {
  const t = useTranslations("notFound");

  return (
    <section className="flex flex-1 items-center py-16 sm:py-24">
      <div className="section-shell">
        <div className="relative overflow-hidden rounded-[2.6rem] bg-brand-cream px-7 py-14 sm:px-16 sm:py-20">
          <Blob className="-top-16 -left-12 h-56 w-56 text-brand-green/10 animate-float" />
          <Blob className="-right-14 -bottom-20 h-72 w-72 text-brand-sun/15 animate-float-slow" />
          <DottedArc className="top-10 right-10 hidden h-24 w-24 text-brand-green/20 sm:block" />

          <div className="relative mx-auto grid max-w-4xl items-center gap-10 sm:grid-cols-2">
            <div className="order-2 flex flex-col items-start gap-5 text-left sm:order-1">
              <span className="eyebrow">{t("eyebrow")}</span>
              <h1 className="text-3xl font-bold text-balance-pretty sm:text-4xl">
                {t("title")}
              </h1>
              <p className="text-lg text-foreground/75 text-balance-pretty">
                {t("subtitle")}
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Link href="/" className="btn-pill-primary">
                  <HomeIcon className="size-5" aria-hidden="true" />
                  {t("home")}
                </Link>
                <Link href="/pamelding" className="btn-pill-outline">
                  {t("enroll")}
                  <ArrowRightIcon className="size-5" aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="order-1 flex justify-center sm:order-2">
              <Image
                src="/brand/not-found.png"
                alt={t("imageAlt")}
                width={420}
                height={420}
                priority
                unoptimized
                className="h-auto w-full max-w-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
