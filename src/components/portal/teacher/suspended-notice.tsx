import { getTranslations } from "next-intl/server";
import { CirclePause } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export async function TeacherSuspendedNotice({ showHomeLink = false }: { showHomeLink?: boolean }) {
  const t = await getTranslations("portal.teacher.suspended");

  return (
    <section
      aria-labelledby="teacher-suspended-title"
      className="soft-card grid gap-3 p-6 sm:p-8"
    >
      <h2
        id="teacher-suspended-title"
        className="flex items-center gap-2 font-heading text-2xl font-semibold text-balance"
      >
        <CirclePause aria-hidden="true" className="size-6 shrink-0 text-muted-foreground" />
        {t("title")}
      </h2>
      <p className="text-pretty text-muted-foreground">{t("body")}</p>
      {showHomeLink ? (
        <div>
          <Link href="/min-side" className={buttonVariants({ variant: "outline" })}>
            {t("back")}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
