import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  GraduationCap,
  Inbox,
  ReceiptText,
  RotateCcw,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { studentDisplayName } from "@/lib/student-name";
import { cn } from "@/lib/utils";

type SignupRow = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  createdAt: string;
};

type DashboardData = {
  activeYearLabel: string | null;
  newApplications: number;
  newTeachers: number;
  duplicatePayments: number;
  rolloverNeeded: number;
  enrolledStudents: number;
  outstandingStudents: number;
  outstandingAmount: number;
  recentApplications: SignupRow[];
};

type DashboardResult =
  | { ok: true; data: DashboardData }
  | { ok: false };

async function getDashboard(): Promise<DashboardResult> {
  try {
    const supabase = await createClient();
    const [
      activeYear,
      newApplications,
      newTeachers,
      duplicatePayments,
      balances,
      students,
      enrollments,
      recentApplications,
    ] = await Promise.all([
      supabase
        .from("school_years")
        .select("id, label")
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("student_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "ny"),
      supabase
        .from("teacher_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "ny"),
      supabase
        .from("duplicate_payment_candidates")
        .select("payment_id", { count: "exact", head: true }),
      supabase
        .from("student_balances")
        .select("student_id, school_year_id, remaining"),
      supabase.from("students").select("id"),
      supabase
        .from("enrollments")
        .select("student_id, school_year_id, status"),
      supabase
        .from("student_applications")
        .select(
          "id, child_first_name, child_last_name, child_email, status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const results = [
      activeYear,
      newApplications,
      newTeachers,
      duplicatePayments,
      balances,
      students,
      enrollments,
      recentApplications,
    ];

    if (results.some((result) => result.error)) {
      return { ok: false };
    }

    const activeYearRow = activeYear.data as {
      id: string;
      label: string;
    } | null;
    const balanceRows =
      (balances.data as
        | {
            student_id: string | null;
            school_year_id: string | null;
            remaining: number | null;
          }[]
        | null) ?? [];
    const enrollmentRows =
      (enrollments.data as
        | {
            student_id: string;
            school_year_id: string;
            status: string;
          }[]
        | null) ?? [];
    const studentRows =
      (students.data as { id: string }[] | null) ?? [];

    const activeBalances = activeYearRow
      ? balanceRows.filter(
          (row) => row.school_year_id === activeYearRow.id,
        )
      : [];
    const outstandingBalances = activeBalances.filter(
      (row) => (row.remaining ?? 0) > 0,
    );
    const activeEnrollmentIds = new Set(
      activeYearRow
        ? enrollmentRows
            .filter(
              (row) =>
                row.school_year_id === activeYearRow.id &&
                row.status === "aktiv",
            )
            .map((row) => row.student_id)
        : [],
    );
    const studentsWithEnrollment = new Set(
      enrollmentRows.map((row) => row.student_id),
    );
    const rolloverNeeded = activeYearRow
      ? studentRows.filter(
          (student) =>
            studentsWithEnrollment.has(student.id) &&
            !activeEnrollmentIds.has(student.id),
        ).length
      : 0;

    return {
      ok: true,
      data: {
        activeYearLabel: activeYearRow?.label ?? null,
        newApplications: newApplications.count ?? 0,
        newTeachers: newTeachers.count ?? 0,
        duplicatePayments: duplicatePayments.count ?? 0,
        rolloverNeeded,
        enrolledStudents: activeEnrollmentIds.size,
        outstandingStudents: outstandingBalances.length,
        outstandingAmount: outstandingBalances.reduce(
          (sum, row) => sum + (row.remaining ?? 0),
          0,
        ),
        recentApplications: (
          (recentApplications.data as
            | {
                id: string;
                child_first_name: string | null;
                child_last_name: string | null;
                child_email: string | null;
                status: string;
                created_at: string;
              }[]
            | null) ?? []
        ).map((row) => ({
          id: row.id,
          name: studentDisplayName(row) || "Navn mangler",
          email: row.child_email,
          status: row.status,
          createdAt: row.created_at,
        })),
      },
    };
  } catch {
    return { ok: false };
  }
}

function formatNok(ore: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(ore / 100);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Dato mangler";
  return date.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Oslo",
  });
}

type AttentionItem = {
  title: string;
  description: string;
  count?: number;
  href: string;
  action: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone: "green" | "yellow" | "red" | "blue";
};

const attentionTone = {
  green: "bg-[#DCEDDD] text-[#216A2B]",
  yellow: "bg-[#FEEDCA] text-[#775108]",
  red: "bg-[#F9DEDB] text-[#8B2F2B]",
  blue: "bg-[#DDEEF9] text-[#245D84]",
};

function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
          <CheckCircle2 aria-hidden="true" className="size-6" />
        </span>
        <h3 className="font-heading text-xl font-semibold">
          Ingen åpne oppgaver
        </h3>
        <p className="mt-1 max-w-sm text-sm text-foreground/58">
          Nye saker og avvik vil vises her når de trenger behandling.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[#ECE8DF]">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.title}>
            <Link
              href={item.href}
              className="group grid min-h-[5.25rem] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 outline-none transition-colors hover:bg-[#FBFAF6] focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:gap-4 sm:px-5"
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full",
                  attentionTone[item.tone],
                )}
              >
                <Icon aria-hidden={true} className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-bold text-foreground">{item.title}</span>
                  {item.count != null ? (
                    <span className="font-heading text-lg font-bold text-foreground">
                      {item.count}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-sm text-foreground/58">
                  {item.description}
                </span>
              </span>
              <span className="hidden items-center gap-1 text-sm font-bold text-[#277A31] sm:flex">
                {item.action}
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                />
              </span>
              <ArrowRight
                aria-hidden="true"
                className="size-5 text-foreground/45 sm:hidden"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default async function AdminDashboardPage({
  params,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const result = await getDashboard();

  if (!result.ok) {
    return (
      <section
        aria-labelledby="dashboard-error-title"
        className="mx-auto max-w-2xl rounded-2xl bg-white p-6 ring-1 ring-[#E3DED3]"
      >
        <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-[#F9DEDB] text-[#8B2F2B]">
          <CircleAlert aria-hidden="true" className="size-5" />
        </span>
        <h1
          id="dashboard-error-title"
          className="font-heading text-2xl font-bold"
        >
          Arbeidsflaten kunne ikke lastes
        </h1>
        <p className="mt-2 max-w-prose text-foreground/62">
          Ingen tall er skjult eller erstattet med null. Prøv å laste siden på
          nytt, eller gå videre til området du skal arbeide i.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={basePath}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3C8F44] px-4 text-sm font-bold text-white outline-none transition-colors hover:bg-[#2F7A37] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Prøv igjen
          </Link>
          <Link
            href={`${basePath}/register`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#DCD7CC] bg-white px-4 text-sm font-bold outline-none transition-colors hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Gå til opptak
          </Link>
        </div>
      </section>
    );
  }

  const data = result.data;
  const attentionItems: AttentionItem[] = [];

  if (!data.activeYearLabel) {
    attentionItems.push({
      title: "Aktivt skoleår mangler",
      description: "Velg skoleår før plassering og innkreving fortsetter.",
      href: `${basePath}/skolear`,
      action: "Velg skoleår",
      icon: CalendarRange,
      tone: "yellow",
    });
  }
  if (data.newApplications > 0) {
    attentionItems.push({
      title: "Nye innmeldinger",
      description: "Venter på gjennomgang og opptaksbeslutning.",
      count: data.newApplications,
      href: `${basePath}/register?status=ny`,
      action: "Gå gjennom",
      icon: ClipboardCheck,
      tone: "green",
    });
  }
  if (data.rolloverNeeded > 0) {
    attentionItems.push({
      title: "Elever må videreføres",
      description: `Mangler plass i ${data.activeYearLabel}.`,
      count: data.rolloverNeeded,
      href: `${basePath}/elever?year=needs_rollover`,
      action: "Plasser elever",
      icon: RotateCcw,
      tone: "yellow",
    });
  }
  if (data.outstandingStudents > 0) {
    attentionItems.push({
      title: "Utestående betalinger",
      description: `${formatNok(data.outstandingAmount)} gjenstår i aktivt skoleår.`,
      count: data.outstandingStudents,
      href: `${basePath}/betaling`,
      action: "Se økonomi",
      icon: Wallet,
      tone: "blue",
    });
  }
  if (data.duplicatePayments > 0) {
    attentionItems.push({
      title: "Betalinger til kontroll",
      description: "Mulige dobbeltføringer må avstemmes.",
      count: data.duplicatePayments,
      href: `${basePath}/betaling/dobbeltforinger`,
      action: "Kontroller",
      icon: ReceiptText,
      tone: "red",
    });
  }

  return (
    <div className="grid gap-7 lg:gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
            Arbeidsflate
          </h1>
          <p className="mt-1 max-w-2xl text-foreground/60">
            Start med sakene som trenger en beslutning eller oppfølging.
          </p>
        </div>
        <Link
          href={`${basePath}/register`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCD7CC] bg-white px-4 text-sm font-bold outline-none transition-colors hover:border-[#BFD9C2] hover:bg-[#F7FBF7] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Inbox aria-hidden="true" className="size-4 text-[#3C8F44]" />
          Åpne opptak
        </Link>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,0.78fr)]">
        <section
          aria-labelledby="attention-title"
          className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]"
        >
          <div className="flex items-center justify-between gap-4 border-b border-[#ECE8DF] px-4 py-4 sm:px-5">
            <div>
              <h2 id="attention-title" className="font-heading text-xl font-bold">
                Krever oppmerksomhet
              </h2>
              <p className="mt-0.5 text-sm text-foreground/55">
                Prioritert etter hva som stopper neste steg.
              </p>
            </div>
            {attentionItems.length > 0 ? (
              <span className="flex size-8 items-center justify-center rounded-full bg-[#FEEDCA] font-heading text-sm font-bold text-[#775108]">
                {attentionItems.length}
                <span className="sr-only"> oppgavegrupper</span>
              </span>
            ) : null}
          </div>
          <AttentionList items={attentionItems} />
        </section>

        <aside className="grid gap-5">
          <section
            aria-labelledby="school-year-title"
            className="rounded-2xl bg-white p-5 ring-1 ring-[#E3DED3]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="school-year-title"
                  className="font-heading text-xl font-bold"
                >
                  Skoleåret
                </h2>
                <p className="mt-0.5 text-sm text-foreground/55">
                  Aktiv driftskontekst
                </p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
                <GraduationCap aria-hidden="true" className="size-5" />
              </span>
            </div>
            <p className="mt-6 font-heading text-3xl font-bold tabular-nums">
              {data.activeYearLabel ?? "Ikke valgt"}
            </p>
            <dl className="mt-5 grid gap-3 border-t border-[#ECE8DF] pt-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-foreground/58">Elever med plass</dt>
                <dd className="font-bold tabular-nums">
                  {data.enrolledStudents}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-foreground/58">Utestående</dt>
                <dd className="font-bold tabular-nums">
                  {formatNok(data.outstandingAmount)}
                </dd>
              </div>
            </dl>
            <Link
              href={`${basePath}/skolear`}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#3C8F44] px-4 text-sm font-bold text-white outline-none transition-colors hover:bg-[#2F7A37] focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Åpne skoleår
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </section>

          <section
            aria-labelledby="other-work-title"
            className="rounded-2xl bg-[#FFF8E9] p-5 ring-1 ring-[#ECDCB9]"
          >
            <h2 id="other-work-title" className="font-heading text-lg font-bold">
              Andre innbokser
            </h2>
            <Link
              href={`${basePath}/laerere?status=ny`}
              className="group mt-3 flex min-h-11 items-center gap-3 rounded-xl bg-white/75 px-3 outline-none transition-colors hover:bg-white focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
                <UserCheck aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-bold">
                Nye lærersøknader
              </span>
              <span className="font-heading text-lg font-bold tabular-nums">
                {data.newTeachers}
              </span>
              <ArrowRight
                aria-hidden="true"
                className="size-4 text-foreground/45 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </section>
        </aside>
      </div>

      <section
        aria-labelledby="recent-title"
        className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#ECE8DF] px-4 py-4 sm:px-5">
          <div>
            <h2 id="recent-title" className="font-heading text-xl font-bold">
              Siste innmeldinger
            </h2>
            <p className="mt-0.5 text-sm text-foreground/55">
              Nyeste registreringer, uavhengig av status.
            </p>
          </div>
          <Link
            href={`${basePath}/register`}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-bold text-[#277A31] outline-none hover:bg-[#F2F7F2] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Se alle
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        {data.recentApplications.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Users
              aria-hidden="true"
              className="mx-auto size-7 text-foreground/30"
            />
            <p className="mt-3 font-bold">Ingen innmeldinger ennå</p>
            <p className="mt-1 text-sm text-foreground/55">
              Nye innmeldinger vises her når de kommer inn.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#ECE8DF]">
            {data.recentApplications.map((application) => (
              <li key={application.id}>
                <Link
                  href={`${basePath}/register?q=${encodeURIComponent(application.name)}`}
                  className="group grid min-h-[4.75rem] gap-2 px-4 py-3 outline-none transition-colors hover:bg-[#FBFAF6] focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5 sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">
                      {application.name}
                    </span>
                    <span className="block truncate text-sm text-foreground/55">
                      {application.email ?? "E-post mangler"}
                    </span>
                  </span>
                  <span className="w-fit rounded-full bg-[#F2F1EB] px-2.5 py-1 text-xs font-bold text-foreground/65">
                    {application.status === "ny"
                      ? "Ny"
                      : application.status === "kontaktet"
                        ? "Kontaktet"
                        : application.status === "akseptert"
                          ? "Akseptert"
                          : application.status === "avslatt"
                            ? "Avslått"
                            : "Arkivert"}
                  </span>
                  <span className="flex items-center justify-between gap-3 text-xs text-foreground/50 sm:min-w-28 sm:justify-end">
                    {formatDate(application.createdAt)}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
