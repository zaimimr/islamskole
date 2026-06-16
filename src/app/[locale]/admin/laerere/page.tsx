import { createClient } from "@/lib/supabase/server";
import { deleteTeacherApplication } from "@/app/[locale]/admin/actions";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { DeleteButton } from "@/components/admin/delete-button";
import { TeacherStatusSelect } from "@/components/admin/teacher-status-select";
import { Pagination } from "@/components/admin/pagination";
import { ExportButton } from "@/components/admin/export-button";
import {
  BulkActions,
  BulkSelectAll,
  BulkRowCheckbox,
} from "@/components/admin/bulk-actions";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TeacherApplicationRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  subjects: string | null;
  message: string | null;
  status: string | null;
  created_at: string | null;
};

const PAGE_SIZE = 25;

async function getApplications(
  page: number,
): Promise<{ rows: TeacherApplicationRow[]; total: number }> {
  try {
    const supabase = await createClient();
    const from = (page - 1) * PAGE_SIZE;
    const { data, count } = await supabase
      .from("teacher_applications")
      .select(
        "id, full_name, email, phone, subjects, message, status, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    return {
      rows: (data as TeacherApplicationRow[] | null) ?? [],
      total: count ?? 0,
    };
  } catch {
    return { rows: [], total: 0 };
  }
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function LaererePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows: applications, total } = await getApplications(page);
  const pageIds = applications.map((a) => a.id);

  return (
    <div>
      <PageHeader
        title="Lærere"
        description="Søknader fra de som vil bli lærer eller frivillig."
      />

      <div className="mb-4 flex justify-end">
        <ExportButton entity="teachers" />
      </div>

      <Card>
        <CardContent className="p-0">
          {applications.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Ingen søknader ennå.
            </p>
          ) : (
            <BulkActions entity="teachers" ids={pageIds}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <BulkSelectAll />
                  </TableHead>
                  <TableHead>Navn</TableHead>
                  <TableHead>E-post</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Fag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dato</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell className="w-8">
                      <BulkRowCheckbox id={application.id} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {application.full_name ?? "-"}
                    </TableCell>
                    <TableCell>
                      {application.email ? (
                        <a
                          href={`mailto:${application.email}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {application.email}
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{application.phone ?? "-"}</TableCell>
                    <TableCell>{application.subjects ?? "-"}</TableCell>
                    <TableCell>
                      <TeacherStatusSelect
                        id={application.id}
                        status={application.status ?? "ny"}
                      />
                    </TableCell>
                    <TableCell>{formatDate(application.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <DeleteButton
                          id={application.id}
                          label="søknad"
                          action={deleteTeacherApplication}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </BulkActions>
          )}
          {total > PAGE_SIZE ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              basePath={`${basePath}/laerere`}
              searchParams={sp}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
