"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Split, X } from "lucide-react";
import { updatePaymentAllocations } from "@/app/[locale]/admin/students-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type AllocationStudent = { id: string; name: string };
export type ExistingAllocation = { studentId: string; amount: number };

type Row = { studentId: string; amountNok: string };

function formatNok(ore: number) {
  return `${(ore / 100).toLocaleString("nb-NO")} kr`;
}

export function AllocatePaymentDialog({
  paymentId,
  paymentAmount,
  students,
  existing,
  suggestedStudentIds,
}: {
  paymentId: string;
  paymentAmount: number;
  students: AllocationStudent[];
  existing: ExistingAllocation[];
  suggestedStudentIds?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const initial: Row[] =
    existing.length > 0
      ? existing.map((row) => ({
          studentId: row.studentId,
          amountNok: String(Math.round(row.amount / 100)),
        }))
      : (suggestedStudentIds ?? []).length > 0
        ? (suggestedStudentIds ?? []).map((id, _index, list) => ({
            studentId: id,
            amountNok: String(
              Math.round(paymentAmount / Math.max(list.length, 1) / 100),
            ),
          }))
        : [{ studentId: "", amountNok: String(Math.round(paymentAmount / 100)) }];

  const [rows, setRows] = useState<Row[]>(initial);

  function reset() {
    setRows(initial);
  }

  const allocatedOre = rows.reduce(
    (sum, row) => sum + Math.round((Number(row.amountNok) || 0) * 100),
    0,
  );
  const restOre = paymentAmount - allocatedOre;

  function update(index: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        studentId: "",
        amountNok: restOre > 0 ? String(Math.round(restOre / 100)) : "",
      },
    ]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function splitEvenly() {
    const withStudent = rows.filter((row) => row.studentId);
    if (withStudent.length === 0) return;
    const share = Math.floor(paymentAmount / withStudent.length / 100);
    const remainder =
      Math.round(paymentAmount / 100) - share * withStudent.length;
    let first = true;
    setRows((current) =>
      current.map((row) => {
        if (!row.studentId) return row;
        const value = first ? share + remainder : share;
        first = false;
        return { ...row, amountNok: String(value) };
      }),
    );
  }

  function save() {
    const payload = rows
      .filter((row) => row.studentId && Number(row.amountNok) > 0)
      .map((row) => ({
        studentId: row.studentId,
        amount: Math.round(Number(row.amountNok) * 100),
      }));

    startTransition(async () => {
      const result = await updatePaymentAllocations(paymentId, payload);
      if (result.ok) {
        toast.success(
          payload.length === 0
            ? "Fordelingen er fjernet"
            : `Fordelt på ${payload.length} barn`,
        );
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const selectClass =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" title="Fordel betalingen på barn">
            <Split className="size-4" />
            Fordel
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fordel betaling</DialogTitle>
          <DialogDescription>
            Betalingen er på {formatNok(paymentAmount)}. Velg hvilke barn den
            dekker og hvor mye som gjelder hvert barn.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {rows.map((row, index) => (
            <div
              key={index}
              className="grid gap-2 sm:grid-cols-[1fr_7rem_auto] sm:items-end"
            >
              <div className="grid gap-2">
                <Label htmlFor={`alloc_student_${index}`}>Barn</Label>
                <select
                  id={`alloc_student_${index}`}
                  value={row.studentId}
                  onChange={(e) => update(index, { studentId: e.target.value })}
                  className={selectClass}
                >
                  <option value="">Velg elev</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`alloc_amount_${index}`}>Beløp (kr)</Label>
                <Input
                  id={`alloc_amount_${index}`}
                  type="number"
                  min="0"
                  step="1"
                  value={row.amountNok}
                  onChange={(e) => update(index, { amountNok: e.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Fjern barn"
                onClick={() => removeRow(index)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="size-4" />
              Legg til barn
            </Button>
            {rows.filter((row) => row.studentId).length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={splitEvenly}
              >
                Del likt
              </Button>
            ) : null}
          </div>

          <p
            className={`text-sm ${
              restOre < 0 ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            Fordelt {formatNok(allocatedOre)} av {formatNok(paymentAmount)}
            {restOre > 0 ? ` · ${formatNok(restOre)} ufordelt` : ""}
            {restOre < 0
              ? ` · ${formatNok(Math.abs(restOre))} for mye fordelt`
              : ""}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Avbryt
          </Button>
          <Button type="button" onClick={save} disabled={pending || restOre < 0}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Lagre fordeling
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
