import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { ClassForm } from "@/components/admin/class-form";

export default async function NyKlassePage({
  params,
}: PageProps<"/[locale]/admin/klasser/ny">) {
  const { locale } = await params;
  const listHref = `${adminBasePath(locale)}/klasser`;

  return (
    <div>
      <PageHeader title="Ny klasse" />
      <ClassForm listHref={listHref} />
    </div>
  );
}
