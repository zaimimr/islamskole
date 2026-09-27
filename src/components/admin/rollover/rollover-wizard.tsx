"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  ChevronDown,
  CircleAlert,
  Loader2,
  LogOut,
} from "lucide-react";
import { confirmRollover } from "@/app/[locale]/admin/students-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  capacityWarnings,
  type RolloverClass,
  type RolloverStudent,
} from "./plan";

function kroner(value: number) {
  return `${value.toLocaleString("nb-NO")} kr`;
}

export function RolloverWizard({
  basePath,
  target,
  source,
  sourceOptions,
  classes,
  students,
  existingCounts,
}: {
  basePath: string;
  target: { id: string; label: string; fee: number };
  source: { id: string; label: string };
  sourceOptions: { id: string; label: string }[];
  classes: RolloverClass[];
  students: RolloverStudent[];
  existingCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [overCapacityOk, setOverCapacityOk] = useState(false);

  const movable = useMemo(
    () => students.filter((student) => !student.placedClassId),
    [students],
  );
  const alreadyPlaced = students.filter((student) => student.placedClassId);

  const [choices, setChoices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      movable.map((student) => [
        student.studentId,
        student.proposedClassId ?? "",
      ]),
    ),
  );

  const classById = useMemo(
    () => new Map(classes.map((item) => [item.id, item])),
    [classes],
  );
  const warnings = useMemo(
    () => capacityWarnings(classes, existingCounts, choices),
    [classes, existingCounts, choices],
  );
  const moving = movable.filter((student) => choices[student.studentId]);
  const staying = movable.length - moving.length;

  const groups = useMemo(() => {
    const map = new Map<string, RolloverStudent[]>();
    for (const student of movable) {
      const list = map.get(student.currentClassId) ?? [];
      list.push(student);
      map.set(student.currentClassId, list);
    }
    return [...map.entries()];
  }, [movable]);

  function optionLabel(item: RolloverClass) {
    const parts = [item.name];
    if (item.price != null && item.price !== target.fee) {
      parts.push(`${kroner(item.price)}, overstyrer årspris`);
    }
    if (item.capacity != null) parts.push(`${item.capacity} plasser`);
    return parts.join(" · ");
  }

  function confirm() {
    startTransition(async () => {
      const result = await confirmRollover({
        fromYearId: source.id,
        toYearId: target.id,
        rows: moving.map((student) => ({
          studentId: student.studentId,
          classId: choices[student.studentId],
        })),
      });
      if (result.ok) {
        toast.success(
          `${result.created} elever har fått plass i ${target.label}`,
          result.skipped > 0
            ? {
                description: `${result.skipped} hadde allerede plass og ble hoppet over`,
              }
            : undefined,
        );
        setConfirmOpen(false);
        router.push(`${basePath}/skolear/${target.id}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <section className="grid gap-4 rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] sm:grid-cols-[minmax(0,18rem)_1fr] sm:items-end sm:p-5">
        <div className="grid gap-2">
          <Label htmlFor="rollover-source">Flytt fra skoleår</Label>
          <SelectField
            id="rollover-source"
            value={source.id}
            onValueChange={(value) =>
              router.push(
                `${basePath}/skolear/${target.id}/rollover?fra=${value}`,
              )
            }
            options={sourceOptions.map((option) => ({
              value: option.id,
              label: option.label,
            }))}
          />
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-xs font-bold text-admin-muted">Flyttes</dt>
            <dd className="font-heading text-xl font-bold tabular-nums">
              {moving.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-admin-muted">Flyttes ikke</dt>
            <dd className="font-heading text-xl font-bold tabular-nums">
              {staying}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-admin-muted">
              Har allerede plass
            </dt>
            <dd className="font-heading text-xl font-bold tabular-nums">
              {alreadyPlaced.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-admin-muted">
              Årspris {target.label}
            </dt>
            <dd className="font-heading text-xl font-bold tabular-nums">
              {kroner(target.fee)}
            </dd>
          </div>
        </dl>
      </section>

      {warnings.length > 0 ? (
        <section
          aria-live="polite"
          className="flex items-start gap-3 rounded-2xl bg-[#FFF8E6] p-4 text-sm text-[#775108] ring-1 ring-[#EFD9A6] sm:p-5"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-bold">Noen klasser blir for fulle</p>
            <ul className="mt-1 grid gap-0.5">
              {warnings.map((warning) => (
                <li key={warning.classId}>
                  {warning.name}: {warning.total} av {warning.capacity} plasser
                  ({warning.total - warning.capacity} for mange)
                </li>
              ))}
            </ul>
            <p className="mt-1">
              Flytt noen elever til en annen klasse, eller bekreft at klassene
              kan gå over kapasitet.
            </p>
          </div>
        </section>
      ) : null}

      {movable.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-admin-muted ring-1 ring-[#E3DED3] sm:p-5">
          Ingen elever i {source.label} mangler plass i {target.label}.
        </p>
      ) : null}

      {groups.map(([classId, list]) => {
        const current = classById.get(classId);
        return (
          <section
            key={classId}
            aria-labelledby={`group-${classId}`}
            className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]"
          >
            <h2
              id={`group-${classId}`}
              className="border-b border-[#ECE8DF] px-4 py-3 font-heading text-lg font-bold sm:px-5"
            >
              {current?.name ?? "Ukjent klasse"}
              <span className="ml-2 font-sans text-sm font-bold text-admin-muted">
                {list.length} {list.length === 1 ? "elev" : "elever"}
              </span>
            </h2>
            <ul className="divide-y divide-[#ECE8DF]">
              {list.map((student) => {
                const choice = choices[student.studentId] ?? "";
                const changed = choice !== (student.proposedClassId ?? "");
                return (
                  <li
                    key={student.studentId}
                    className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_minmax(0,20rem)] sm:items-center sm:px-5"
                  >
                    <div>
                      <p className="font-bold">
                        <Link
                          href={`${basePath}/elever/${student.studentId}`}
                          className="underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {student.name}
                        </Link>
                        {student.age != null ? (
                          <span className="ml-2 text-sm font-normal text-admin-muted">
                            {student.age} år
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-admin-muted">
                        {student.proposedClassId ? (
                          <span className="inline-flex items-center gap-1">
                            {current?.name}
                            <ArrowRight
                              aria-hidden="true"
                              className="size-3.5"
                            />
                            {classById.get(student.proposedClassId)?.name}
                            <span className="sr-only">foreslått</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#FEEDCA] px-2 py-0.5 text-xs font-bold text-[#775108]">
                            <LogOut aria-hidden="true" className="size-3.5" />
                            Siste klasse, slutter
                          </span>
                        )}
                        {changed ? (
                          <span className="rounded-full bg-[#EFF8FD] px-2 py-0.5 text-xs font-bold text-[#245D7C]">
                            Endret
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor={`choice-${student.studentId}`}
                        className="sr-only"
                      >
                        Klasse i {target.label} for {student.name}
                      </label>
                      <SelectField
                        id={`choice-${student.studentId}`}
                        value={choice}
                        onValueChange={(value) =>
                          setChoices((prev) => ({
                            ...prev,
                            [student.studentId]: value,
                          }))
                        }
                        options={[
                          { value: "", label: "Flyttes ikke" },
                          ...classes.map((item) => ({
                            value: item.id,
                            label: `${optionLabel(item)}${item.id === student.currentClassId ? " · samme klasse" : ""}`,
                          })),
                        ]}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {alreadyPlaced.length > 0 ? (
        <details className="group rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] sm:p-5">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-sm font-bold text-admin-muted outline-none hover:bg-[#F2F1EB] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            Har allerede plass i {target.label} ({alreadyPlaced.length})
            <ChevronDown
              aria-hidden="true"
              className="size-4 transition-transform group-open:rotate-180"
            />
          </summary>
          <ul className="mt-2 grid gap-1 text-sm">
            {alreadyPlaced.map((student) => (
              <li key={student.studentId}>
                <span className="font-bold">{student.name}</span>
                <span className="text-admin-muted">
                  {" "}
                  ·{" "}
                  {classById.get(student.placedClassId ?? "")?.name ??
                    "Ukjent klasse"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {movable.length > 0 ? (
        <div className="sticky bottom-4 z-10 flex flex-col gap-2 rounded-2xl bg-white p-3 ring-1 ring-[#D8D3C8] sm:flex-row sm:items-center sm:justify-between">
          <p className="px-1 text-sm">
            <span className="font-bold">{moving.length} elever</span> får plass
            i {target.label}
            {warnings.length > 0 ? (
              <span className="text-[#775108]">
                {" "}
                · {warnings.length} klasser over kapasitet
              </span>
            ) : null}
          </p>
          <AlertDialog
            open={confirmOpen}
            onOpenChange={(open) => {
              setConfirmOpen(open);
              if (!open) setOverCapacityOk(false);
            }}
          >
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  disabled={pending || moving.length === 0}
                  className="min-h-11 rounded-xl px-5 font-bold"
                >
                  Flytt {moving.length} elever
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Flytte {moving.length} elever til {target.label}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Hver elev får plass i valgt klasse og årspris{" "}
                  {kroner(target.fee)}
                  {classes.some(
                    (item) => item.price != null && item.price !== target.fee,
                  )
                    ? " (eller klassens egen pris der den overstyrer årsprisen)"
                    : ""}
                  . {staying > 0 ? `${staying} elever flyttes ikke. ` : ""}
                  Alt lagres samlet, og endringen logges.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {warnings.length > 0 ? (
                <label className="flex min-h-11 items-start gap-3 rounded-xl bg-[#FFF8E6] p-3 text-sm text-[#775108]">
                  <input
                    type="checkbox"
                    checked={overCapacityOk}
                    onChange={(event) =>
                      setOverCapacityOk(event.target.checked)
                    }
                    className="mt-0.5 size-4 accent-[#2F7938]"
                  />
                  Jeg vet at {warnings.map((w) => w.name).join(", ")} går over
                  kapasitet.
                </label>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirm}
                  disabled={pending || (warnings.length > 0 && !overCapacityOk)}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Flytt elever
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}
    </>
  );
}
