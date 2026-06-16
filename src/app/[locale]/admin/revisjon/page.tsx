import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 50;

type AuditRow = {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  created_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMetadata(metadata: unknown) {
  if (metadata == null) return "-";
  if (typeof metadata === "object") {
    const entries = Object.entries(metadata as Record<string, unknown>);
    if (entries.length === 0) return "-";
    return entries
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(", ");
  }
  return String(metadata);
}

async function getEntries(
  page: number,
): Promise<{ rows: AuditRow[]; total: number }> {
  try {
    const supabase = await createClient();
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count } = await supabase
      .from("audit_log")
      .select(
        "id, actor_email, action, entity_type, entity_id, metadata, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to);
    return {
      rows: (data as AuditRow[] | null) ?? [],
      total: count ?? 0,
    };
  } catch {
    return { rows: [], total: 0 };
  }
}

export default async function RevisjonPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/revisjon">) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const sp = await searchParams;
  const pageParam = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const pageIndex = page - 1;

  const { rows, total } = await getEntries(pageIndex);
  const hasPrev = page > 1;
  const hasNext = page * PAGE_SIZE < total;

  return (
    <div>
      <PageHeader
        title="Revisjon"
        description="Logg over endringer gjort i adminpanelet."
      />

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Ingen hendelser ennå.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tidspunkt</TableHead>
                  <TableHead>Bruker</TableHead>
                  <TableHead>Handling</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Detaljer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </TableCell>
                    <TableCell>{row.actor_email ?? "-"}</TableCell>
                    <TableCell className="font-medium">{row.action}</TableCell>
                    <TableCell>{row.entity_type}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.entity_id ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatMetadata(row.metadata)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm">
        {hasPrev ? (
          <Link
            href={`${basePath}/revisjon?page=${page - 1}`}
            className="underline-offset-2 hover:underline"
          >
            Forrige
          </Link>
        ) : (
          <span className="text-muted-foreground">Forrige</span>
        )}
        <span className="text-muted-foreground">Side {page}</span>
        {hasNext ? (
          <Link
            href={`${basePath}/revisjon?page=${page + 1}`}
            className="underline-offset-2 hover:underline"
          >
            Neste
          </Link>
        ) : (
          <span className="text-muted-foreground">Neste</span>
        )}
      </div>
    </div>
  );
}
