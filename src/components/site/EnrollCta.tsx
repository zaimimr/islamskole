import { getTranslations } from "next-intl/server";
import { ArrowRightIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Blob, DottedArc } from "./decor";

export async function EnrollCta() {
  const t = await getTranslations("enroll");

  return (
    <section className="py-16 sm:py-24" aria-labelledby="enroll-heading">
      <div className="section-shell">
        <div className="relative overflow-hidden rounded-[2.6rem] bg-brand-green px-7 py-14 text-center text-primary-foreground sm:px-16 sm:py-20">
          <Blob className="-top-16 -left-10 h-56 w-56 text-primary-foreground/10 animate-float" />
          <Blob className="-right-12 -bottom-16 h-64 w-64 text-primary-foreground/10 animate-float-slow" />
          <DottedArc className="top-8 right-10 hidden h-24 w-24 text-primary-foreground/20 sm:block" />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5">
            <h2
              id="enroll-heading"
              className="text-3xl font-bold text-balance-pretty sm:text-4xl"
            >
              {t("title")}
            </h2>
            <p className="text-lg text-primary-foreground/90 text-balance-pretty">
              {t("body")}
            </p>
            <Link href="/pamelding" className="btn-pill-cream mt-2">
              {t("cta")}
              <ArrowRightIcon className="size-5" aria-hidden="true" />
            </Link>
            <p className="text-sm text-primary-foreground/75">{t("note")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
