import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { ClassForm, type ClassRecord } from "@/components/admin/class-form";

async function getClass(id: string): Promise<ClassRecord | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("classes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as ClassRecord | null) ?? null;
  } catch {
    return null;
  }
}

export default async function RedigerKlassePage({
  params,
}: PageProps<"/[locale]/admin/klasser/[id]">) {
  const { locale, id } = await params;
  const listHref = `${adminBasePath(locale)}/klasser`;
  const classRecord = await getClass(id);

  if (!classRecord) notFound();

  return (
    <div>
      <PageHeader title="Rediger klasse" />
      <ClassForm classRecord={classRecord} listHref={listHref} />
    </div>
  );
}
