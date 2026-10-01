import { getTranslations } from "next-intl/server";
import { ChevronRight, ClipboardCheck, NotebookPen, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { lessonTitle } from "@/lib/lessons";
import { formatNok } from "@/lib/money";
import type { PortalChild, PortalClassNote, PortalTimeSlot } from "@/lib/portal/types";
import { formatPortalDay, type PortalTerm } from "@/lib/portal/parent-format";

export function childName(child: Pick<PortalChild, "first_name" | "last_name">) {
  return [child.first_name, child.last_name].filter(Boolean).join(" ");
}

export function joinNames(people: PortalChild["teachers"], locale: string) {
  const names = people
    .map((person) => [person.first_name, person.last_name].filter(Boolean).join(" "))
    .filter(Boolean);
  return new Intl.ListFormat(locale === "en" ? "en-GB" : "nb-NO", { type: "conjunction" }).format(names);
}

export function ClassNoteBody({
  note,
  labels,
}: {
  note: Pick<PortalClassNote, "homework" | "summary">;
  labels: { homework: string; summary: string };
}) {
  return (
    <dl className="grid gap-3">
      {note.homework ? (
        <div className="grid gap-1">
          <dt className="text-sm font-bold text-brand-green-dark">{labels.homework}</dt>
          <dd className="text-pretty whitespace-pre-line">{note.homework}</dd>
        </div>
      ) : null}
      {note.summary ? (
        <div className="grid gap-1">
          <dt className="text-sm font-bold text-brand-green-dark">{labels.summary}</dt>
          <dd className="text-pretty whitespace-pre-line">{note.summary}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function noteLessonLabel(
  note: Pick<PortalClassNote, "start_position" | "end_position" | "subject">,
  slots: PortalTimeSlot[],
  wholeDayLabel: string,
): string | null {
  if (note.start_position === null || note.end_position === null) return null;
  const title = lessonTitle(
    { start_position: note.start_position, end_position: note.end_position, subject: note.subject },
    slots,
    wholeDayLabel,
  );
  return title === wholeDayLabel ? null : title;
}

export async function ChildCard({
  child,
  locale,
  notes,
  slots,
  noteIsRecent,
  attendance,
  term,
}: {
  child: PortalChild;
  locale: string;
  notes: PortalClassNote[];
  slots: PortalTimeSlot[];
  noteIsRecent: boolean;
  attendance: { absent: number; late: number; present: number };
  term: PortalTerm;
}) {
  const t = await getTranslations({ locale, namespace: "portal.parent" });
  const name = childName(child);
  const className = locale === "en" ? child.class_name_en : child.class_name_no;
  const teachers = joinNames(child.teachers, locale);
  const termLabel = t(`term.${term}`);
  const remaining = child.remaining_ore;
  const note = notes[0] ?? null;
  const written = notes.filter((row) => row.homework || row.summary);

  return (
    <article
      aria-labelledby={`child-${child.student_id}-${child.class_id}`}
      className="soft-card overflow-hidden"
    >
      <header className="grid gap-1 bg-primary/8 px-5 pt-5 pb-4 sm:px-6">
        <h3
          id={`child-${child.student_id}-${child.class_id}`}
          className="font-heading text-2xl font-semibold text-balance"
        >
          {name}
        </h3>
        <p className="font-semibold text-brand-green-dark">
          {className}
          {child.age != null ? <span className="font-normal text-foreground/75"> · {t("age", { age: child.age })}</span> : null}
        </p>
        <p className="text-sm text-foreground/75">
          {teachers ? t("teachers", { names: teachers, count: child.teachers.length }) : t("noTeacher")}
        </p>
      </header>

      <div className="grid divide-y divide-foreground/8">
        <section aria-labelledby={`note-${child.student_id}-${child.class_id}`} className="grid gap-3 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h4 id={`note-${child.student_id}-${child.class_id}`} className="flex items-center gap-2 font-heading text-lg font-semibold">
              <NotebookPen aria-hidden="true" className="size-5 text-brand-green-dark" />
              {note && !noteIsRecent ? t("note.latestTitle") : t("note.weekTitle")}
            </h4>
            {note?.date ? (
              <p className="text-sm text-muted-foreground first-letter:uppercase">
                {formatPortalDay(note.date, locale)}
              </p>
            ) : null}
          </div>
          {written.length ? (
            <div className="grid gap-4">
              {written.map((row) => {
                const label = noteLessonLabel(row, slots, t("lessons.wholeDay"));
                return (
                  <div key={row.id} className="grid gap-2">
                    {label ? <p className="font-semibold">{label}</p> : null}
                    <ClassNoteBody
                      note={row}
                      labels={{ homework: t("note.homework"), summary: t("note.summary") }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-pretty text-muted-foreground">{t("note.empty")}</p>
          )}
        </section>

        <section aria-labelledby={`absence-${child.student_id}-${child.class_id}`} className="grid gap-3 px-5 py-5 sm:px-6">
          <h4 id={`absence-${child.student_id}-${child.class_id}`} className="flex items-center gap-2 font-heading text-lg font-semibold">
            <ClipboardCheck aria-hidden="true" className="size-5 text-brand-green-dark" />
            {t("attendance.title")}
          </h4>
          <p className="text-pretty">
            {attendance.absent
              ? t("attendance.absent", { count: attendance.absent, term: termLabel })
              : t("attendance.none", { term: termLabel })}
            {attendance.late ? ` ${t("attendance.late", { count: attendance.late })}` : null}
          </p>
        </section>

        {remaining != null ? (
          <section className="flex items-start gap-2 px-5 py-4 sm:px-6">
            <Wallet aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-green-dark" />
            <p className="text-pretty">
              {remaining > 0 ? (
                <>
                  <span className="font-semibold">
                    {t("payment.remaining", { amount: formatNok(remaining), year: child.school_year_label })}
                  </span>{" "}
                  <Link
                    href="/min-side/okonomi"
                    className="rounded-sm font-semibold text-brand-green-dark underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {t("payment.pay")}
                  </Link>
                </>
              ) : (
                t("payment.paid", { year: child.school_year_label })
              )}
            </p>
          </section>
        ) : null}

        <Link
          href={`/min-side/barn/${child.student_id}`}
          className="flex min-h-12 items-center justify-between gap-3 px-5 py-3 font-semibold text-brand-green-dark outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-6"
        >
          {t("detailLink", { name: child.first_name ?? name })}
          <ChevronRight aria-hidden="true" className="size-5" />
        </Link>
      </div>
    </article>
  );
}
