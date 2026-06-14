import Link from "next/link";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteClass } from "@/app/[locale]/admin/actions";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { DeleteButton } from "@/components/admin/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ClassRow = {
  id: string;
  name_no: string | null;
  age_min: number | null;
  age_max: number | null;
  capacity: number | null;
  sort_order: number | null;
  published: boolean | null;
};

async function getClasses(): Promise<ClassRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("classes")
      .select("id, name_no, age_min, age_max, capacity, sort_order, published")
      .order("sort_order", { ascending: true });
    return (data as ClassRow[] | null) ?? [];
  } catch {
    return [];
  }
}

function formatAge(min: number | null, max: number | null) {
  if (min == null && max == null) return "-";
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

  return (
    <div>
      <PageHeader
        title="Klasser"
        description="Klasser og læreplaner."
        newHref={`${basePath}/klasser/ny`}
        newLabel="Ny klasse"
      />

      <Card>
        <CardContent className="p-0">
          {classes.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Ingen klasser ennå.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Alder</TableHead>
                  <TableHead>Kapasitet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.name_no ?? "(uten navn)"}
                    </TableCell>
                    <TableCell>{formatAge(item.age_min, item.age_max)}</TableCell>
                    <TableCell>{item.capacity ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={item.published ? "default" : "secondary"}>
                        {item.published ? "Publisert" : "Utkast"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`${basePath}/klasser/${item.id}`}
                          aria-label="Rediger"
                          className={buttonVariants({
                            variant: "ghost",
                            size: "icon",
                          })}
                        >
                          <Pencil className="size-4" />
                        </Link>
                        <DeleteButton
                          id={item.id}
                          label="klasse"
                          action={deleteClass}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
