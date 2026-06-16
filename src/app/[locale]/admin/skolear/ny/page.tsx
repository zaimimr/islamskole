import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { SchoolYearForm } from "@/components/admin/school-year-form";

export default async function NyttSkolearPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const listHref = `${adminBasePath(locale)}/skolear`;

  return (
    <div>
      <PageHeader
        title="Nytt skoleår"
        description="Opprett et nytt skoleår, f.eks. 2026/2027."
      />
      <SchoolYearForm listHref={listHref} />
    </div>
  );
}
