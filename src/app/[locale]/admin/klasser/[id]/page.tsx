import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
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
    <div className="grid gap-6 lg:gap-7">
      <header>
        <Link
          href={listHref}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#277A31] outline-none transition-colors hover:bg-[#F2F7F2] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Tilbake til klasser
        </Link>
        <h1 className="mt-3 text-balance font-heading text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
          {classRecord.name_no ?? "Rediger klasse"}
        </h1>
        <p className="mt-1 max-w-2xl text-admin-muted">
          Oppdater innhold, rammer og offentlig synlighet for klassen.
        </p>
      </header>
      <ClassForm classRecord={classRecord} listHref={listHref} />
    </div>
  );
}
