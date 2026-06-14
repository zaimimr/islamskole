import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Home />;
}

function Home() {
  const t = useTranslations("hero");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">
        {t("eyebrow")}
      </p>
      <h1 className="font-heading text-4xl font-bold sm:text-6xl">{t("title")}</h1>
      <p className="max-w-xl text-lg text-muted-foreground">{t("subtitle")}</p>
      <p className="text-sm text-muted-foreground">
        Foundation ready. Home page is built by the team.
      </p>
    </main>
  );
}
