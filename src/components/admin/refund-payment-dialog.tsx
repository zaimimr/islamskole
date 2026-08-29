"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Undo2 } from "lucide-react";
import { refundPaymentAction } from "@/app/[locale]/admin/students-actions";
import { formatNok } from "@/lib/money";
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

export type RefundAllocation = {
  studentId: string;
  name: string;
  amount: number;
  refunded: number;
};

type RefundMethod = "vipps" | "kontant" | "bank" | "annet";

export function RefundPaymentDialog({
  paymentId,
  capturedAmount,
  refundedAmount,
  payerName,
  vippsRefundAvailable,
  allocations,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger,
}: {
  paymentId: string;
  capturedAmount: number;
  refundedAmount: number;
  payerName: string | null;
  vippsRefundAvailable: boolean;
  allocations: RefundAllocation[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [mode, setMode] = useState<"vipps" | "manual">(
    vippsRefundAvailable ? "vipps" : "manual",
  );
  const [manualMethod, setManualMethod] = useState<RefundMethod>("bank");
  const [refundedOn, setRefundedOn] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const refundable = capturedAmount - refundedAmount;
  const hasLines = allocations.length > 0;

  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const lines = useMemo(() => {
    if (!hasLines) {
      const raw = amounts["__whole__"];
      const value =
        raw === undefined ? refundable : Math.round(Number(raw || 0) * 100);
      return [
        {
          studentId: null as string | null,
          amount: Number.isFinite(value) ? value : 0,
          max: refundable,
          name: "Hele betalingen",
        },
      ];
    }
    return allocations.map((allocation) => {
      const max = Math.max(allocation.amount - allocation.refunded, 0);
      const raw = amounts[allocation.studentId];
      const value =
        raw === undefined ? 0 : Math.round(Number(raw || 0) * 100);
      return {
        studentId: allocation.studentId as string | null,
        amount: Number.isFinite(value) ? Math.max(value, 0) : 0,
        max,
        name: allocation.name,
      };
    });
  }, [allocations, amounts, hasLines, refundable]);

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const overLine = lines.find((line) => line.amount > line.max);
  const invalid =
    total <= 0 || total > refundable || Boolean(overLine) || !reason.trim();

  function reset() {
    setStep("form");
    setAmounts({});
    setReason("");
    setMode(vippsRefundAvailable ? "vipps" : "manual");
  }

  function setLineAmount(key: string, value: string) {
    setAmounts((current) => ({ ...current, [key]: value }));
  }

  function fillAll() {
    if (!hasLines) {
      setAmounts({ __whole__: String(refundable / 100) });
      return;
    }
    const next: Record<string, string> = {};
    for (const allocation of allocations) {
      const max = Math.max(allocation.amount - allocation.refunded, 0);
      next[allocation.studentId] = max > 0 ? String(max / 100) : "";
    }
    setAmounts(next);
  }

  function submit() {
    startTransition(async () => {
      const result = await refundPaymentAction({
        paymentId,
        lines: lines
          .filter((line) => line.amount > 0)
          .map((line) => ({ studentId: line.studentId, amount: line.amount })),
        method: mode === "vipps" ? "vipps" : manualMethod,
        reason,
        refundedOn: mode === "manual" ? refundedOn : null,
      });
      if (result.ok) {
        toast.success(`${formatNok(total)} refundert`);
        setOpen(false);
        reset();
        router.refresh();
      } else {
        toast.error(result.error);
        setStep("form");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      {hideTrigger ? null : (
        <DialogTrigger
          render={
            <Button
              variant="outline"
              title="Refunder hele eller deler av betalingen"
              className="min-h-11 rounded-xl px-3 font-bold"
            >
              <Undo2 className="size-4" />
              Refunder
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-lg">
        {step === "form" ? (
          <>
            <DialogHeader>
              <span className="mb-2 flex size-11 items-center justify-center rounded-full bg-[#F9DEDB] text-[#8B2F2B]">
                <Undo2 aria-hidden="true" className="size-5" />
              </span>
              <DialogTitle className="font-heading text-2xl">
                Refunder betaling
              </DialogTitle>
              <DialogDescription>
                Velg hvor mye som skal betales tilbake. Du kan refundere hele
                betalingen, ett barns andel eller et mindre beløp.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2 text-sm">
              <div
                role="radiogroup"
                aria-label="Refusjonsmåte"
                className="grid grid-cols-2 gap-2"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "vipps"}
                  disabled={!vippsRefundAvailable}
                  onClick={() => setMode("vipps")}
                  className={`min-h-11 rounded-xl px-3 text-sm font-bold ring-1 disabled:cursor-not-allowed disabled:opacity-50 ${
                    mode === "vipps"
                      ? "bg-[#DCEDDD] text-[#25501F] ring-[#9CC49A]"
                      : "bg-white text-admin-muted ring-[#E8E3D9]"
                  }`}
                >
                  Vipps-refusjon
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "manual"}
                  onClick={() => setMode("manual")}
                  className={`min-h-11 rounded-xl px-3 text-sm font-bold ring-1 ${
                    mode === "manual"
                      ? "bg-[#DCEDDD] text-[#25501F] ring-[#9CC49A]"
                      : "bg-white text-admin-muted ring-[#E8E3D9]"
                  }`}
                >
                  Manuell refusjon
                </button>
              </div>
              {mode === "manual" ? (
                <p className="text-xs text-admin-muted">
                  Registrerer bare at pengene er betalt tilbake utenfor
                  systemet. Ingen penger flyttes herfra.
                </p>
              ) : null}

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold tracking-[0.04em] uppercase text-admin-muted">
                    Beløp per barn
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 rounded-lg px-2 text-xs font-bold"
                    onClick={fillAll}
                  >
                    Refunder alt
                  </Button>
                </div>
                {hasLines ? (
                  allocations.map((allocation) => {
                    const max = Math.max(
                      allocation.amount - allocation.refunded,
                      0,
                    );
                    return (
                      <div
                        key={allocation.studentId}
                        className="flex items-center justify-between gap-3 rounded-xl bg-[#FAF9F5] px-3 py-2 ring-1 ring-[#E8E3D9]"
                      >
                        <div>
                          <p className="font-bold">{allocation.name}</p>
                          <p className="text-xs text-admin-muted">
                            Betalt {formatNok(allocation.amount)}
                            {allocation.refunded > 0
                              ? ` · ${formatNok(allocation.refunded)} refundert`
                              : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={max / 100}
                            step={1}
                            placeholder="0"
                            value={amounts[allocation.studentId] ?? ""}
                            onChange={(event) =>
                              setLineAmount(
                                allocation.studentId,
                                event.target.value,
                              )
                            }
                            disabled={max <= 0}
                            aria-label={`Beløp for ${allocation.name} i kroner`}
                            className="h-11 w-24 rounded-xl text-right tabular-nums"
                          />
                          <span className="text-xs text-admin-muted">kr</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-[#FAF9F5] px-3 py-2 ring-1 ring-[#E8E3D9]">
                    <div>
                      <p className="font-bold">Hele betalingen</p>
                      <p className="text-xs text-admin-muted">
                        Kan refunderes: {formatNok(refundable)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={refundable / 100}
                        step={1}
                        value={amounts["__whole__"] ?? refundable / 100}
                        onChange={(event) =>
                          setLineAmount("__whole__", event.target.value)
                        }
                        aria-label="Beløp i kroner"
                        className="h-11 w-24 rounded-xl text-right tabular-nums"
                      />
                      <span className="text-xs text-admin-muted">kr</span>
                    </div>
                  </div>
                )}
              </div>

              {mode === "manual" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`refund-method-${paymentId}`}>Måte</Label>
                    <select
                      id={`refund-method-${paymentId}`}
                      value={manualMethod}
                      onChange={(event) =>
                        setManualMethod(event.target.value as RefundMethod)
                      }
                      className="h-11 rounded-xl border border-input bg-transparent px-3 text-sm shadow-xs"
                    >
                      <option value="bank">Bankoverføring</option>
                      <option value="kontant">Kontant</option>
                      <option value="annet">Annet</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`refund-date-${paymentId}`}>Dato</Label>
                    <Input
                      id={`refund-date-${paymentId}`}
                      type="date"
                      value={refundedOn}
                      onChange={(event) => setRefundedOn(event.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid gap-1.5">
                <Label htmlFor={`refund-reason-${paymentId}`} required>
                  Begrunnelse
                </Label>
                <Input
                  id={`refund-reason-${paymentId}`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Hvorfor refunderes beløpet?"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="rounded-xl bg-[#FFF8E9] px-4 py-4 text-[#6B5524] ring-1 ring-[#E8D6AA]">
                <p className="text-xs font-bold tracking-[0.04em] uppercase">
                  Til refusjon
                </p>
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                  {formatNok(total)}
                </p>
                <p className="mt-1 text-xs">
                  Av {formatNok(capturedAmount)} betalt
                  {refundedAmount > 0
                    ? ` · ${formatNok(refundedAmount)} tidligere refundert`
                    : ""}
                </p>
              </div>
              {overLine ? (
                <p className="text-sm font-bold text-[#8B2F2B]">
                  Beløpet for {overLine.name} overstiger det som kan refunderes
                  ({formatNok(overLine.max)}).
                </p>
              ) : null}
            </div>

            <DialogFooter className="[&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:rounded-xl [&_[data-slot=button]]:px-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={invalid}
                onClick={() => setStep("confirm")}
              >
                Refunder {formatNok(total)}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <span className="mb-2 flex size-11 items-center justify-center rounded-full bg-[#F9DEDB] text-[#8B2F2B]">
                <AlertTriangle aria-hidden="true" className="size-5" />
              </span>
              <DialogTitle className="font-heading text-2xl">
                Er du sikker på at du vil refundere {formatNok(total)}?
              </DialogTitle>
              <DialogDescription>
                {mode === "vipps"
                  ? `${formatNok(total)} betales tilbake${payerName ? ` til ${payerName}` : ""} via Vipps. Pengene forlater kontoen med én gang, og handlingen kan ikke angres.`
                  : `${formatNok(total)} registreres som betalt tilbake utenfor systemet. Barnets betalingsstatus endres.`}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2 py-2 text-sm">
              {lines
                .filter((line) => line.amount > 0)
                .map((line) => (
                  <div
                    key={line.studentId ?? "whole"}
                    className="flex items-center justify-between rounded-xl bg-[#FAF9F5] px-3 py-2 ring-1 ring-[#E8E3D9]"
                  >
                    <span className="font-bold">{line.name}</span>
                    <span className="tabular-nums">
                      {formatNok(line.amount)}
                    </span>
                  </div>
                ))}
            </div>

            <DialogFooter className="[&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:rounded-xl [&_[data-slot=button]]:px-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("form")}
                disabled={pending}
              >
                Tilbake
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={submit}
                disabled={pending}
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Refunder {formatNok(total)}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
