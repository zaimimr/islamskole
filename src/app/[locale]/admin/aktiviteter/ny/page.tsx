import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { EventForm } from "@/components/admin/event-form";

export default async function NyAktivitetPage({
  params,
}: PageProps<"/[locale]/admin/aktiviteter/ny">) {
  const { locale } = await params;
  const listHref = `${adminBasePath(locale)}/aktiviteter`;

  return (
    <div>
      <PageHeader title="Ny aktivitet" />
      <EventForm listHref={listHref} />
    </div>
  );
}
