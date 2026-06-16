import Link from "next/link";
import {
  CalendarDays,
  GraduationCap,
  UserPlus,
  Users,
  Inbox,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

type SignupRow = {
  id: string;
  name: string;
  email: string | null;
  status: string | null;
  created_at: string | null;
};

async function getDashboard() {
  const empty = {
    students: 0,
    studentsNew: 0,
    teachers: 0,
    teachersNew: 0,
    events: 0,
    classes: 0,
    recentStudents: [] as SignupRow[],
    recentTeachers: [] as SignupRow[],
  };
  try {
    const supabase = await createClient();
    const [
      students,
      studentsNew,
      teachers,
      teachersNew,
      events,
      classes,
      recentStudents,
      recentTeachers,
    ] = await Promise.all([
      supabase
        .from("student_applications")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("student_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "ny"),
      supabase
        .from("teacher_applications")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("teacher_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "ny"),
      supabase.from("events").select("id", { count: "exact", head: true }),
      supabase.from("classes").select("id", { count: "exact", head: true }),
      supabase
        .from("student_applications")
        .select("id, child_name, email, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("teacher_applications")
        .select("id, full_name, email, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    return {
      students: students.count ?? 0,
      studentsNew: studentsNew.count ?? 0,
      teachers: teachers.count ?? 0,
      teachersNew: teachersNew.count ?? 0,
      events: events.count ?? 0,
      classes: classes.count ?? 0,
      recentStudents: (
        (recentStudents.data as
          | {
              id: string;
              child_name: string | null;
              email: string | null;
              status: string | null;
              created_at: string | null;
            }[]
          | null) ?? []
      ).map((r) => ({
        id: r.id,
        name: r.child_name ?? "-",
        email: r.email,
        status: r.status,
        created_at: r.created_at,
      })),
      recentTeachers: (
        (recentTeachers.data as
          | {
              id: string;
              full_name: string | null;
              email: string | null;
              status: string | null;
              created_at: string | null;
            }[]
          | null) ?? []
      ).map((r) => ({
        id: r.id,
        name: r.full_name ?? "-",
        email: r.email,
        status: r.status,
        created_at: r.created_at,
      })),
    };
  } catch {
    return empty;
  }
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("nb-NO", { dateStyle: "medium" });
}

function SignupList({
  rows,
  emptyLabel,
}: {
  rows: SignupRow[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-6 pb-6 text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex items-center justify-between gap-3 px-6 py-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {row.email ?? "-"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {row.status === "ny" && (
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-brand-green-dark">
                Ny
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(row.created_at)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminDashboardPage({
  params,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const d = await getDashboard();

  const stats = [
    {
      label: "Påmeldinger",
      value: d.students,
      hint: `${d.studentsNew} nye`,
      icon: UserPlus,
      href: `${basePath}/register`,
    },
    {
      label: "Lærersøknader",
      value: d.teachers,
      hint: `${d.teachersNew} nye`,
      icon: Users,
      href: `${basePath}/laerere`,
    },
    {
      label: "Aktiviteter",
      value: d.events,
      hint: "publisert og utkast",
      icon: CalendarDays,
      href: `${basePath}/aktiviteter`,
    },
    {
      label: "Klasser",
      value: d.classes,
      hint: "totalt",
      icon: GraduationCap,
      href: `${basePath}/klasser`,
    },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Oversikt</h1>
        <p className="text-muted-foreground">
          Påmeldinger av elever og søknader fra lærere, samlet på ett sted.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, hint, icon: Icon, href }) => (
          <Link key={label} href={href} className="group">
            <Card className="transition-colors group-hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Inbox className="size-4" />
              Siste påmeldinger
            </CardTitle>
            <Link
              href={`${basePath}/register`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Se alle
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <SignupList
              rows={d.recentStudents}
              emptyLabel="Ingen påmeldinger ennå."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Inbox className="size-4" />
              Siste lærersøknader
            </CardTitle>
            <Link
              href={`${basePath}/laerere`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Se alle
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <SignupList
              rows={d.recentTeachers}
              emptyLabel="Ingen søknader ennå."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
