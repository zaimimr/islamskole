import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarClock,
  ChevronDown,
  CircleCheck,
  Mail,
  MessageSquareText,
  Phone,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteTeacherApplication } from "@/app/[locale]/admin/actions";
import { adminBasePath } from "@/components/admin/paths";
import { DeleteButton } from "@/components/admin/delete-button";
import { TeacherStatusSelect } from "@/components/admin/teacher-status-select";
import { TeacherRegisterDialog } from "@/components/admin/teacher-register-dialog";
import { TeacherRemoveButton } from "@/components/admin/teacher-remove-button";
import { formatNok } from "@/lib/money";
import { Pagination } from "@/components/admin/pagination";
import { ExportButton } from "@/components/admin/export-button";
import {
  BulkActions,
  BulkSelectAll,
  BulkRowCheckbox,
} from "@/components/admin/bulk-actions";
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
  q: string,
  status: string,
): Promise<{ rows: TeacherApplicationRow[]; total: number }> {
  try {
    const supabase = await createClient();
    const from = (page - 1) * PAGE_SIZE;
    let query = supabase
      .from("teacher_applications")
      .select(
        "id, full_name, email, phone, subjects, message, status, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });
    const term = q.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,subjects.ilike.%${term}%`,
      );
    }
    if (status) query = query.eq("status", status);
    const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
    return {
      rows: (data as TeacherApplicationRow[] | null) ?? [],
      total: count ?? 0,
    };
  } catch {
    return { rows: [], total: 0 };
  }
}

async function getApplicationCounts() {
  try {
    const supabase = await createClient();
    const [all, fresh, contacted] = await Promise.all([
      supabase
        .from("teacher_applications")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("teacher_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "ny"),
      supabase
        .from("teacher_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "kontaktet"),
    ]);
    return {
      all: all.count ?? 0,
      fresh: fresh.count ?? 0,
      contacted: contacted.count ?? 0,
    };
  } catch {
    return { all: 0, fresh: 0, contacted: 0 };
  }
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("nb-NO", {
    timeZone: "Europe/Oslo",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type TeacherRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  teacher_note: string | null;
};

async function getRegisteredTeachers(): Promise<{
  teachers: TeacherRow[];
  familyByGuardian: Map<string, string>;
  giftTotals: Map<string, { amount: number; students: number }>;
}> {
  try {
    const supabase = await createClient();
    const [teacherResult, linkResult, giftResult] = await Promise.all([
      supabase
        .from("guardians")
        .select("id, first_name, last_name, email, phone, teacher_note")
        .eq("is_teacher", true)
        .order("first_name", { ascending: true }),
      supabase.from("family_guardians").select("guardian_id, family_id"),
      supabase
        .from("teacher_gift_report")
        .select("teacher_guardian_id, student_count, total_amount"),
    ]);

    const familyByGuardian = new Map<string, string>();
    for (const row of (linkResult.data as
      | { guardian_id: string; family_id: string }[]
      | null) ?? []) {
      if (!familyByGuardian.has(row.guardian_id)) {
        familyByGuardian.set(row.guardian_id, row.family_id);
      }
    }

    const giftTotals = new Map<string, { amount: number; students: number }>();
    for (const row of (giftResult.data as
      | {
          teacher_guardian_id: string | null;
          student_count: number | null;
          total_amount: number | null;
        }[]
      | null) ?? []) {
      if (!row.teacher_guardian_id) continue;
      const entry = giftTotals.get(row.teacher_guardian_id) ?? {
        amount: 0,
        students: 0,
      };
      entry.amount += row.total_amount ?? 0;
      entry.students += row.student_count ?? 0;
      giftTotals.set(row.teacher_guardian_id, entry);
    }

    return {
      teachers: (teacherResult.data as TeacherRow[] | null) ?? [],
      familyByGuardian,
      giftTotals,
    };
  } catch {
    return {
      teachers: [],
      familyByGuardian: new Map(),
      giftTotals: new Map(),
    };
  }
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
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const [{ rows: applications, total }, counts, registry] = await Promise.all([
    getApplications(page, q, status),
    getApplicationCounts(),
    getRegisteredTeachers(),
  ]);
  const pageIds = applications.map((a) => a.id);
  const filtered = Boolean(q || status);

  return (
    <div className="grid gap-5 sm:gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-balance font-heading text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Lærere
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-admin-muted sm:text-base">
            Registrerte lærere med kobling til familie, og søknader fra
            kandidater som vil bidra.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TeacherRegisterDialog />
          <ExportButton entity="teachers" />
        </div>
      </header>

      <section
        aria-labelledby="teacher-registry"
        className="rounded-2xl bg-white p-5 ring-1 ring-[#E3DED3]"
      >
        <h2 id="teacher-registry" className="font-heading text-xl font-bold">
          Registrerte lærere ({registry.teachers.length})
        </h2>
        <div className="mt-3">
          {registry.teachers.length > 0 ? (
            <ul className="grid gap-1.5">
              {registry.teachers.map((teacher) => {
                const name =
                  [teacher.first_name, teacher.last_name]
                    .filter(Boolean)
                    .join(" ") || "(uten navn)";
                const familyId = registry.familyByGuardian.get(teacher.id);
                const gift = registry.giftTotals.get(teacher.id);
                return (
                  <li
                    key={teacher.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF9F5] px-3 py-2 text-sm ring-1 ring-[#E8E3D9]"
                  >
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-bold">{name}</span>
                      {teacher.email ? (
                        <span className="text-admin-muted">
                          {teacher.email}
                        </span>
                      ) : null}
                      {teacher.teacher_note ? (
                        <span className="text-admin-muted">
                          · {teacher.teacher_note}
                        </span>
                      ) : null}
                      {familyId ? (
                        <Link
                          href={`${basePath}/familier/${familyId}`}
                          className="rounded-full bg-[#DCEDDD] px-2 py-0.5 text-xs font-bold text-[#216A2B] outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          Har barn på skolen
                        </Link>
                      ) : (
                        <span className="rounded-full bg-[#F0F0ED] px-2 py-0.5 text-xs font-bold text-[#4E5550]">
                          Ikke koblet til familie
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-3">
                      {gift ? (
                        <span className="text-admin-muted">
                          Fritatt{" "}
                          <span className="font-bold text-foreground tabular-nums">
                            {formatNok(gift.amount)}
                          </span>{" "}
                          ({gift.students} barn)
                        </span>
                      ) : null}
                      <TeacherRemoveButton
                        guardianId={teacher.id}
                        name={name}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-admin-muted">
              Ingen lærere er registrert ennå. Legg til en lærer manuelt eller
              registrer fra en søknad under.
            </p>
          )}
        </div>
      </section>

      <section
        aria-label="Status for lærersøknader"
        className="grid overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3] sm:grid-cols-3"
      >
        <div className="flex min-h-24 items-center gap-3 px-4 py-4 sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FEEDCA] text-[#775108]">
            <CalendarClock aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-heading text-2xl font-bold tabular-nums">
              {counts.fresh}
            </p>
            <p className="text-sm text-admin-muted">Nye søknader</p>
          </div>
        </div>
        <div className="flex min-h-24 items-center gap-3 border-t border-[#ECE8DF] px-4 py-4 sm:border-t-0 sm:border-l sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EFF8FD] text-[#245D7C]">
            <Mail aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-heading text-2xl font-bold tabular-nums">
              {counts.contacted}
            </p>
            <p className="text-sm text-admin-muted">Kontaktet</p>
          </div>
        </div>
        <div className="flex min-h-24 items-center gap-3 border-t border-[#ECE8DF] px-4 py-4 sm:border-t-0 sm:border-l sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
            <BriefcaseBusiness aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-heading text-2xl font-bold tabular-nums">
              {counts.all}
            </p>
            <p className="text-sm text-admin-muted">Totalt mottatt</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] sm:p-5">
        <form
          action={`${basePath}/laerere`}
          role="search"
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-end"
        >
          <div className="grid gap-1.5">
            <label htmlFor="teacher-search" className="text-sm font-bold">
              Søk i søknader
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#2F7938]" />
              <input
                id="teacher-search"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Navn, e-post, telefon eller fag"
                className="min-h-11 w-full rounded-xl border border-[#CFC9BD] bg-white pr-4 pl-10 text-sm outline-none placeholder:text-admin-muted focus-visible:border-[#2F7938] focus-visible:ring-3 focus-visible:ring-[#2F7938]/20"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="teacher-status" className="text-sm font-bold">
              Vis status
            </label>
            <select
              id="teacher-status"
              name="status"
              defaultValue={status}
              className="min-h-11 w-full rounded-xl border border-[#CFC9BD] bg-white px-3 text-sm outline-none focus-visible:border-[#2F7938] focus-visible:ring-3 focus-visible:ring-[#2F7938]/20"
            >
              <option value="">Alle statuser</option>
              <option value="ny">Ny</option>
              <option value="kontaktet">Kontaktet</option>
              <option value="arkivert">Arkivert</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-admin-action px-4 text-sm font-bold text-white outline-none hover:bg-[#245E2B] focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Finn
            </button>
            {filtered ? (
              <Link
                href={`${basePath}/laerere`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#CFC9BD] px-3 text-sm font-bold outline-none hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Nullstill
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <section
        aria-labelledby="teacher-inbox-title"
        className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#ECE8DF] px-4 py-4 sm:px-5">
          <div>
            <h2
              id="teacher-inbox-title"
              className="font-heading text-xl font-bold"
            >
              Kandidater til oppfølging
            </h2>
            <p className="mt-0.5 text-sm text-admin-muted" aria-live="polite">
              {total} {total === 1 ? "søknad" : "søknader"}
              {filtered ? " passer valgte filtre" : " i innboksen"}
            </p>
          </div>
          <BriefcaseBusiness
            aria-hidden="true"
            className="size-5 text-admin-muted"
          />
        </div>
        {applications.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
              <CircleCheck aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-4 font-heading text-xl font-bold">
              {filtered
                ? "Ingen kandidater passer filtrene"
                : "Ingen søknader ennå"}
            </p>
            <p className="mt-1 max-w-md text-sm text-admin-muted">
              {filtered
                ? "Prøv et annet søk eller velg en annen status."
                : "Nye lærer- og frivilligsøknader vises her."}
            </p>
          </div>
        ) : (
          <BulkActions entity="teachers" ids={pageIds}>
            <div className="flex min-h-12 items-center gap-3 border-b border-[#ECE8DF] bg-[#FBFAF6] px-4 text-sm text-admin-muted sm:px-5">
              <BulkSelectAll />
              <span>Velg alle på denne siden</span>
            </div>
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
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
                        <span className="font-bold">
                          {application.full_name ?? "-"}
                        </span>
                        {application.message ? (
                          <details className="group mt-1 whitespace-normal">
                            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-bold text-[#277A31] outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                              Les melding
                              <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                            </summary>
                            <p className="mt-2 max-w-sm rounded-xl bg-[#F8F6F0] p-3 text-sm font-normal text-foreground">
                              {application.message}
                            </p>
                          </details>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {application.email ? (
                          <a
                            href={`mailto:${application.email}`}
                            className="font-bold text-[#277A31] underline-offset-2 hover:underline"
                          >
                            {application.email}
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {application.phone ? (
                          <a
                            href={`tel:${application.phone}`}
                            className="font-bold text-[#277A31] underline-offset-2 hover:underline"
                          >
                            {application.phone}
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{application.subjects ?? "-"}</TableCell>
                      <TableCell>
                        <TeacherStatusSelect
                          id={application.id}
                          status={application.status ?? "ny"}
                        />
                      </TableCell>
                      <TableCell>
                        {formatDate(application.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TeacherRegisterDialog
                            compact
                            sourceApplicationId={application.id}
                            defaultName={application.full_name}
                            defaultEmail={application.email}
                            defaultPhone={application.phone}
                          />
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
            </div>
            <ul className="divide-y divide-[#ECE8DF] lg:hidden">
              {applications.map((application) => (
                <li key={application.id} className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="pt-1">
                      <BulkRowCheckbox id={application.id} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-heading text-lg font-bold">
                            {application.full_name ?? "Navn mangler"}
                          </p>
                          <p className="mt-0.5 text-sm text-admin-muted">
                            {application.subjects ?? "Fag ikke oppgitt"}
                          </p>
                        </div>
                        <TeacherStatusSelect
                          id={application.id}
                          status={application.status ?? "ny"}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {application.email ? (
                          <a
                            href={`mailto:${application.email}`}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#F2F7F2] px-3 text-sm font-bold text-[#277A31] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            <Mail className="size-4" />
                            Send e-post
                          </a>
                        ) : null}
                        {application.phone ? (
                          <a
                            href={`tel:${application.phone}`}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#F2F7F2] px-3 text-sm font-bold text-[#277A31] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            <Phone className="size-4" />
                            Ring
                          </a>
                        ) : null}
                      </div>
                      {application.message ? (
                        <details className="group mt-3 rounded-xl bg-[#F8F6F0] p-3">
                          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                            <MessageSquareText className="size-4 text-[#2F7938]" />
                            Les melding
                            <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" />
                          </summary>
                          <p className="pt-2 text-sm">{application.message}</p>
                        </details>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between border-t border-[#ECE8DF] pt-3">
                        <span className="text-xs text-admin-muted">
                          Mottatt {formatDate(application.created_at)}
                        </span>
                        <DeleteButton
                          id={application.id}
                          label="søknad"
                          action={deleteTeacherApplication}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
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
      </section>
    </div>
  );
}
