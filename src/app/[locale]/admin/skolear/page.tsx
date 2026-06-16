import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { ClickableRow } from "@/components/admin/clickable-row";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type YearRow = {
  id: string;
  label: string;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  fee: number | null;
  enrollments: { count: number }[];
};

async function getYears(): Promise<YearRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("school_years")
      .select("id, label, starts_on, ends_on, is_active, fee, enrollments(count)")
      .order("label", { ascending: false });
    return (data as YearRow[] | null) ?? [];
  } catch {
    return [];
  }
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("nb-NO", { dateStyle: "medium" });
}

export default async function SkolearPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const years = await getYears();

  return (
    <div>
      <PageHeader
        title="Skoleår"
        description="Opprett skoleår, sett aktivt år og se elever per år."
        newHref={`${basePath}/skolear/ny`}
        newLabel="Nytt skoleår"
      />

      <Card>
        <CardContent className="p-0">
          {years.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Ingen skoleår ennå.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Skoleår</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Semesteravgift</TableHead>
                  <TableHead>Elever</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {years.map((year) => {
                  const start = formatDate(year.starts_on);
                  const end = formatDate(year.ends_on);
                  return (
                    <ClickableRow
                      key={year.id}
                      href={`${basePath}/skolear/${year.id}`}
                    >
                      <TableCell className="font-medium">
                        {year.label}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {start && end ? `${start} – ${end}` : "-"}
                      </TableCell>
                      <TableCell>
                        {year.fee != null
                          ? `${year.fee.toLocaleString("nb-NO")} kr`
                          : "-"}
                      </TableCell>
                      <TableCell>{year.enrollments?.[0]?.count ?? 0}</TableCell>
                      <TableCell>
                        {year.is_active ? <Badge>Aktivt</Badge> : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <ChevronRight className="size-4" />
                      </TableCell>
                    </ClickableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
