import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/auth";

type ExportEntity = "students" | "applications" | "payments" | "teachers";

type Column = { key: string; header: string };

type ExportResult = {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
};

type ExportQuery = PromiseLike<ExportResult> & {
  eq: (column: string, value: string) => ExportQuery;
  or: (filters: string) => ExportQuery;
};

type ExportTable =
  | "students"
  | "student_applications"
  | "payments"
  | "teacher_applications";

type EntityConfig = {
  table: ExportTable;
  select: string;
  columns: Column[];
};

const entityConfigs: Record<ExportEntity, EntityConfig> = {
  students: {
    table: "students",
    select:
      "id, child_first_name, child_last_name, full_name, birth_date, gender, address, postal_code, city, email, phone, mother_first_name, mother_last_name, mother_phone, mother_email, father_first_name, father_last_name, father_phone, father_email, level_quran, level_arabic, level_islam, notes, created_at",
    columns: [
      { key: "child_first_name", header: "Fornavn" },
      { key: "child_last_name", header: "Etternavn" },
      { key: "birth_date", header: "Fødselsdato" },
      { key: "gender", header: "Kjønn" },
      { key: "address", header: "Adresse" },
      { key: "postal_code", header: "Postnummer" },
      { key: "city", header: "Poststed" },
      { key: "email", header: "E-post (kontakt)" },
      { key: "phone", header: "Telefon (kontakt)" },
      { key: "mother_first_name", header: "Mor fornavn" },
      { key: "mother_last_name", header: "Mor etternavn" },
      { key: "mother_phone", header: "Mor mobil" },
      { key: "mother_email", header: "Mor e-post" },
      { key: "father_first_name", header: "Far fornavn" },
      { key: "father_last_name", header: "Far etternavn" },
      { key: "father_phone", header: "Far mobil" },
      { key: "father_email", header: "Far e-post" },
      { key: "level_quran", header: "Nivå Koran" },
      { key: "level_arabic", header: "Nivå Arabisk" },
      { key: "level_islam", header: "Nivå Islam" },
      { key: "notes", header: "Notater" },
      { key: "created_at", header: "Registrert" },
    ],
  },
  applications: {
    table: "student_applications",
    select:
      "id, child_name, child_first_name, child_last_name, child_age, birth_date, gender, address, postal_code, city, guardian_name, email, phone, mother_first_name, mother_last_name, mother_phone, mother_email, father_first_name, father_last_name, father_phone, father_email, desired_class, level_quran, level_arabic, level_islam, message, status, created_at",
    columns: [
      { key: "child_first_name", header: "Fornavn" },
      { key: "child_last_name", header: "Etternavn" },
      { key: "child_age", header: "Alder" },
      { key: "birth_date", header: "Fødselsdato" },
      { key: "gender", header: "Kjønn" },
      { key: "address", header: "Adresse" },
      { key: "postal_code", header: "Postnummer" },
      { key: "city", header: "Poststed" },
      { key: "email", header: "E-post (kontakt)" },
      { key: "phone", header: "Mobil (kontakt)" },
      { key: "mother_first_name", header: "Mor fornavn" },
      { key: "mother_last_name", header: "Mor etternavn" },
      { key: "mother_phone", header: "Mor mobil" },
      { key: "mother_email", header: "Mor e-post" },
      { key: "father_first_name", header: "Far fornavn" },
      { key: "father_last_name", header: "Far etternavn" },
      { key: "father_phone", header: "Far mobil" },
      { key: "father_email", header: "Far e-post" },
      { key: "desired_class", header: "Ønsket klasse" },
      { key: "level_quran", header: "Nivå Koran" },
      { key: "level_arabic", header: "Nivå Arabisk" },
      { key: "level_islam", header: "Nivå Islam" },
      { key: "message", header: "Melding" },
      { key: "status", header: "Status" },
      { key: "created_at", header: "Dato" },
    ],
  },
  payments: {
    table: "payments",
    select:
      "id, student_id, school_year_id, status, amount, currency, created_at",
    columns: [
      { key: "student_id", header: "Elev-ID" },
      { key: "school_year_id", header: "Skoleår-ID" },
      { key: "status", header: "Status" },
      { key: "amount", header: "Beløp (øre)" },
      { key: "currency", header: "Valuta" },
      { key: "created_at", header: "Dato" },
    ],
  },
  teachers: {
    table: "teacher_applications",
    select: "id, full_name, email, phone, subjects, message, status, created_at",
    columns: [
      { key: "full_name", header: "Navn" },
      { key: "email", header: "E-post" },
      { key: "phone", header: "Telefon" },
      { key: "subjects", header: "Fag" },
      { key: "message", header: "Melding" },
      { key: "status", header: "Status" },
      { key: "created_at", header: "Dato" },
    ],
  },
};

function escapeCsvField(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(columns: Column[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map((c) => escapeCsvField(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvField(row[c.key])).join(","));
  }
  return lines.join("\r\n");
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/export/[entity]">,
) {
  const { entity } = await ctx.params;
  const config = entityConfigs[entity as ExportEntity];
  if (!config) {
    return new Response("Ukjent eksport", { status: 404 });
  }

  const isAdmin = await getIsAdmin();
  if (!isAdmin) {
    return new Response("Ikke autorisert", { status: 403 });
  }

  const supabase = await createClient();
  let query = supabase
    .from(config.table)
    .select(config.select)
    .order("created_at", { ascending: false }) as unknown as ExportQuery;

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  if (status && status !== "alle" && entity !== "students") {
    query = query.eq("status", status);
  }

  const term = (searchParams.get("q") ?? "").replace(/[%,()]/g, " ").trim();
  if (term) {
    if (entity === "applications") {
      query = query.or(
        `child_name.ilike.%${term}%,guardian_name.ilike.%${term}%,email.ilike.%${term}%`,
      );
    } else if (entity === "students") {
      query = query.or(
        `full_name.ilike.%${term}%,guardian_name.ilike.%${term}%,email.ilike.%${term}%`,
      );
    } else if (entity === "teachers") {
      query = query.or(
        `full_name.ilike.%${term}%,email.ilike.%${term}%,subjects.ilike.%${term}%`,
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const rows = (data as Record<string, unknown>[] | null) ?? [];
  const csv = `﻿${buildCsv(config.columns, rows)}`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${entity}.csv"`,
    },
  });
}
