import Link from "next/link";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";
import { deleteEvent } from "@/app/[locale]/admin/actions";
import { adminBasePath } from "@/components/admin/paths";
import { siteUrl, localePath } from "@/lib/seo";
import { PageHeader } from "@/components/admin/page-header";
import { DeleteButton } from "@/components/admin/delete-button";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
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

type EventRow = {
  id: string;
  slug: string | null;
  title_no: string | null;
  starts_at: string | null;
  location: string | null;
  published: boolean | null;
};

async function getEvents(): Promise<EventRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("events")
      .select("id, slug, title_no, starts_at, location, published")
      .order("starts_at", { ascending: false });
    return (data as EventRow[] | null) ?? [];
  } catch {
    return [];
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

export default async function AktiviteterPage({
  params,
}: PageProps<"/[locale]/admin/aktiviteter">) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const events = await getEvents();

  return (
    <div>
      <PageHeader
        title="Aktiviteter"
        description="Arrangementer og nyheter."
        newHref={`${basePath}/aktiviteter/ny`}
        newLabel="Ny aktivitet"
      />

      <Card>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Ingen aktiviteter ennå.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tittel</TableHead>
                  <TableHead>Dato</TableHead>
                  <TableHead>Sted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">
                      {event.title_no ?? "(uten tittel)"}
                    </TableCell>
                    <TableCell>{formatDate(event.starts_at)}</TableCell>
                    <TableCell>{event.location ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={event.published ? "default" : "secondary"}>
                        {event.published ? "Publisert" : "Utkast"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {event.published && event.slug ? (
                          <CopyLinkButton
                            url={`${siteUrl}${localePath(
                              locale as Locale,
                              `/aktiviteter/${event.slug}`,
                            )}`}
                          />
                        ) : null}
                        <Link
                          href={`${basePath}/aktiviteter/${event.id}`}
                          aria-label="Rediger"
                          className={buttonVariants({
                            variant: "ghost",
                            size: "icon",
                          })}
                        >
                          <Pencil className="size-4" />
                        </Link>
                        <DeleteButton
                          id={event.id}
                          label="aktivitet"
                          action={deleteEvent}
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
