import Link from "next/link";
import { CalendarDays, GraduationCap, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

async function getCounts() {
  try {
    const supabase = await createClient();
    const [events, classes, publishedEvents, publishedClasses] =
      await Promise.all([
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("published", true),
        supabase
          .from("classes")
          .select("id", { count: "exact", head: true })
          .eq("published", true),
      ]);
    return {
      events: events.count ?? 0,
      classes: classes.count ?? 0,
      published: (publishedEvents.count ?? 0) + (publishedClasses.count ?? 0),
    };
  } catch {
    return { events: 0, classes: 0, published: 0 };
  }
}

export default async function AdminDashboardPage({
  params,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const counts = await getCounts();

  const stats = [
    { label: "Aktiviteter", value: counts.events, icon: CalendarDays },
    { label: "Klasser", value: counts.classes, icon: GraduationCap },
    { label: "Publiserte", value: counts.published, icon: CheckCircle2 },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Oversikt</h1>
        <p className="text-muted-foreground">
          Velkommen til adminpanelet for Islamskole Bærum.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aktiviteter</CardTitle>
            <CardDescription>
              Administrer arrangementer og nyheter.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`${basePath}/aktiviteter`}
              className={buttonVariants({ variant: "outline" })}
            >
              Gå til aktiviteter
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Klasser</CardTitle>
            <CardDescription>Administrer klasser og læreplaner.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`${basePath}/klasser`}
              className={buttonVariants({ variant: "outline" })}
            >
              Gå til klasser
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
