import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import {
  ClassSortList,
  type SortableClass,
} from "@/components/admin/class-sort-list";
import { Card, CardContent } from "@/components/ui/card";

type ClassRow = {
  id: string;
  name_no: string | null;
  age_min: number | null;
  age_max: number | null;
  published: boolean | null;
};

async function getClasses(): Promise<ClassRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("classes")
      .select("id, name_no, age_min, age_max, published")
      .order("sort_order", { ascending: true });
    return (data as ClassRow[] | null) ?? [];
  } catch {
    return [];
  }
}

function formatAge(min: number | null, max: number | null) {
  if (min == null && max == null) return "Alder ikke satt";
  if (min != null && max != null) return `${min}-${max} år`;
  if (min != null) return `fra ${min} år`;
  return `til ${max} år`;
}

export default async function KlasserPage({
  params,
}: PageProps<"/[locale]/admin/klasser">) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const classes = await getClasses();

  const items: SortableClass[] = classes.map((c) => ({
    id: c.id,
    name: c.name_no ?? "(uten navn)",
    age: formatAge(c.age_min, c.age_max),
    published: Boolean(c.published),
  }));

  return (
    <div>
      <PageHeader
        title="Klasser"
        description="Dra i håndtaket for å endre rekkefølgen klassene vises i."
        newHref={`${basePath}/klasser/ny`}
        newLabel="Ny klasse"
      />

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Ingen klasser ennå.
            </p>
          ) : (
            <ClassSortList classes={items} basePath={basePath} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
