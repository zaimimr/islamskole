import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { StudentForm } from "@/components/admin/student-form";

export default async function NyElevPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const listHref = `${adminBasePath(locale)}/elever`;

  return (
    <div>
      <PageHeader title="Ny elev" description="Registrer en ny elev." />
      <StudentForm listHref={listHref} />
    </div>
  );
}
