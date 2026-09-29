import type { ReactNode } from "react";
import { ClassNoteBody } from "@/components/portal/parent/child-card";
import { formatPortalDay } from "@/lib/portal/parent-format";
import type { AttendanceStatus, PortalClassNote } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

const statusTone: Record<AttendanceStatus | "none", string> = {
  til_stede: "bg-primary/12 text-brand-green-dark",
  sent: "bg-brand-sun/35 text-[#4a3a00]",
  fravaer: "bg-destructive/10 text-destructive",
  meldt_fravaer: "bg-accent text-accent-foreground",
  none: "bg-muted text-muted-foreground",
};

export function AttendanceYear({
  id,
  title,
  historyTitle,
  days,
  statusByDate,
  statusLabel,
  locale,
  children,
}: {
  id: string;
  title: string;
  historyTitle: string;
  days: { id: string; date: string }[];
  statusByDate: Map<string, AttendanceStatus>;
  statusLabel: (status: AttendanceStatus | "none") => string;
  locale: string;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="soft-card grid gap-4 p-5 sm:p-6">
      <h2 id={id} className="font-heading text-xl font-semibold">
        {title}
      </h2>
      {children}
      {days.length ? (
        <div className="grid gap-2 border-t border-foreground/8 pt-4">
          <h3 className="font-semibold">{historyTitle}</h3>
          <ul className="grid gap-1">
            {days.map((day) => {
              const status = statusByDate.get(day.date) ?? "none";
              return (
                <li key={day.id} data-date={day.date} className="flex min-h-11 items-center justify-between gap-3">
                  <span className="first-letter:uppercase">{formatPortalDay(day.date, locale)}</span>
                  <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", statusTone[status])}>
                    {statusLabel(status)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function NotesYear({
  id,
  title,
  empty,
  notes,
  labels,
  locale,
}: {
  id: string;
  title: string;
  empty: string;
  notes: (Pick<PortalClassNote, "id" | "homework" | "summary"> & { date: string | null })[];
  labels: { homework: string; summary: string };
  locale: string;
}) {
  const visible = notes
    .filter((note) => note.homework || note.summary)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <h2 id={id} className="font-heading text-xl font-semibold">
        {title}
      </h2>
      {visible.length ? (
        <ol className="soft-card grid divide-y divide-foreground/8">
          {visible.map((note) => (
            <li key={note.id} data-date={note.date ?? undefined} className="grid gap-3 p-5 sm:p-6">
              <h3 className="font-heading text-lg font-semibold first-letter:uppercase">
                {formatPortalDay(note.date, locale)}
              </h3>
              <ClassNoteBody note={note} labels={labels} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
