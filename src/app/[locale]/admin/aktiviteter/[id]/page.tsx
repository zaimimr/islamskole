import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { EventForm, type EventRecord } from "@/components/admin/event-form";

async function getEvent(id: string): Promise<EventRecord | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as EventRecord | null) ?? null;
  } catch {
    return null;
  }
}

export default async function RedigerAktivitetPage({
  params,
}: PageProps<"/[locale]/admin/aktiviteter/[id]">) {
  const { locale, id } = await params;
  const listHref = `${adminBasePath(locale)}/aktiviteter`;
  const event = await getEvent(id);

  if (!event) notFound();

  return (
    <div>
      <PageHeader title="Rediger aktivitet" />
      <EventForm event={event} listHref={listHref} />
    </div>
  );
}
