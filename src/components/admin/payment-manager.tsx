"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Link2,
  Mail,
  RefreshCw,
  Check,
  Undo2,
  Ban,
  Trash2,
  EyeOff,
  RotateCcw,
  MoreHorizontal,
  Plus,
  Users,
  ChevronDown,
} from "lucide-react";
import {
  createVippsPayment,
  voidPayment,
  restorePayment,
  registerManualPayment,
  syncPaymentStatus,
  captureVippsPayment,
  refundVippsPayment,
  cancelVippsPayment,
  sendPaymentLink,
  deletePayment,
} from "@/app/[locale]/admin/students-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SchoolYearOption = { id: string; label: string };
export type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  schoolYear: string | null;
  schoolYearId: string | null;
  description: string | null;
  status: string;
  method: string;
  paid_at: string | null;
  redirect_url: string | null;
  created_at: string | null;
  reference: string | null;
  voided_at: string | null;
  void_reason: string | null;
  payer_name: string | null;
  payer_phone: string | null;
  payer_email: string | null;
  vipps_state: string | null;
  vipps_payment_method: string | null;
  psp_reference: string | null;
  last_synced_at: string | null;
  captured_at: string | null;
  allocatedAmount: number | null;
  sharedWith: number | null;
};

export type YearBalance = { owed: number; paid: number; remaining: number };

const statusLabels: Record<string, string> = {
  opprettet: "Venter",
  autorisert: "Autorisert",
  fanget: "Betalt",
  avbrutt: "Avbrutt",
  refundert: "Refundert",
  feilet: "Feilet",
};

const methodLabels: Record<string, string> = {
  vipps: "Vipps",
  kontant: "Kontant",
  bank: "Bank",
  annet: "Annet",
};

function formatNok(ore: number) {
  return `${(ore / 100).toLocaleString("nb-NO")} kr`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

function shortNote(payment: PaymentRow): string | null {
  if (payment.payer_name) return payment.payer_name;
  if (payment.payer_phone) return payment.payer_phone;
  const description = payment.description;
  if (!description) return null;
  const tail = description.split("·").pop()?.trim();
  return tail && tail.length > 1 ? tail : description;
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`truncate ${mono ? "font-mono text-xs" : ""}`} title={value}>
        {value}
      </dd>
    </div>
  );
}

export function PaymentManager({
  studentId,
  classByYear,
  schoolYears,
  defaultSchoolYearId,
  defaultAmount,
  balancesByYear,
  payments,
}: {
  studentId: string;
  classByYear: Record<string, string>;
  schoolYears: SchoolYearOption[];
  defaultSchoolYearId: string | null;
  defaultAmount: number | null;
  balancesByYear: Record<string, YearBalance>;
  payments: PaymentRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [year, setYear] = useState(
    defaultSchoolYearId ?? schoolYears[0]?.id ?? "",
  );
  const [formOpen, setFormOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mode, setMode] = useState<"vipps" | "manual">("vipps");

  const currentClass = classByYear[year] ?? null;
  const balance = balancesByYear[year] ?? null;
  const remainingNok =
    balance && balance.remaining > 0
      ? Math.round(balance.remaining / 100)
      : null;
  const suggestedAmount = remainingNok ?? defaultAmount ?? null;

  const yearPayments = payments.filter(
    (payment) => payment.schoolYearId === year || payment.schoolYearId === null,
  );

  const progress =
    balance && balance.owed > 0
      ? Math.min(100, Math.round((balance.paid / balance.owed) * 100))
      : balance && balance.paid > 0
        ? 100
        : 0;

  const state =
    balance && balance.owed > 0 && balance.remaining <= 0
      ? "betalt"
      : balance && balance.paid > 0
        ? "delvis"
        : "ubetalt";

  function handleCreate(formData: FormData) {
    formData.set("student_id", studentId);
    formData.set("school_year_id", year);
    startTransition(async () => {
      const result = await createVippsPayment(formData);
      if (result.ok) {
        toast.success(
          result.emailed
            ? `Vipps-lenke sendt til ${result.emailedTo} foresatt${
                result.emailedTo === 1 ? "" : "e"
              }`
            : "Vipps-lenke opprettet (ingen foresatt har e-post - bruk Kopier)",
        );
        setFormOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleManual(formData: FormData) {
    formData.set("student_id", studentId);
    formData.set("school_year_id", year);
    startTransition(async () => {
      const result = await registerManualPayment(formData);
      if (result.ok) {
        toast.success("Betaling registrert");
        setFormOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Noe gikk galt");
      }
    });
  }

  function copyLink(paymentId: string) {
    const base = (
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
    ).replace(/\/$/, "");
    navigator.clipboard.writeText(`${base}/api/vipps/pay/${paymentId}`);
    toast.success("Betalingslenke kopiert");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>Betaling</CardTitle>
        <div className="flex items-center gap-2">
          {currentClass ? (
            <Badge variant="outline">{currentClass}</Badge>
          ) : (
            <Badge variant="destructive">Ingen klasse</Badge>
          )}
          <select
            aria-label="Skoleår"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
          >
            {schoolYears.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-2xl font-bold">
              {formatNok(balance?.paid ?? 0)}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                av {formatNok(balance?.owed ?? 0)}
              </span>
            </p>
            {state === "betalt" ? (
              <Badge>Ferdig betalt</Badge>
            ) : state === "delvis" ? (
              <Badge variant="secondary">
                Gjenstår {formatNok(balance?.remaining ?? 0)}
              </Badge>
            ) : (
              <Badge variant="outline">Ikke betalt</Badge>
            )}
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full rounded-full transition-all ${
                state === "betalt" ? "bg-primary" : "bg-amber-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {formOpen ? (
          <div className="grid gap-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "vipps" ? "default" : "outline"}
                onClick={() => setMode("vipps")}
              >
                Send Vipps-lenke
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "manual" ? "default" : "outline"}
                onClick={() => setMode("manual")}
              >
                Registrer mottatt beløp
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => setFormOpen(false)}
              >
                Avbryt
              </Button>
            </div>

            {mode === "vipps" ? (
              <form
                key={`vipps-${year}`}
                action={handleCreate}
                className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
              >
                <div className="grid gap-2">
                  <Label htmlFor="amount_nok" required>
                    Beløp (kr)
                  </Label>
                  <Input
                    id="amount_nok"
                    name="amount_nok"
                    type="number"
                    min="1"
                    step="1"
                    required
                    defaultValue={suggestedAmount ?? ""}
                  />
                </div>
                <Button type="submit" disabled={pending || !currentClass}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Opprett og send
                </Button>
              </form>
            ) : (
              <form
                key={`manual-${year}`}
                action={handleManual}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
              >
                <div className="grid gap-2">
                  <Label htmlFor="manual_amount" required>
                    Beløp (kr)
                  </Label>
                  <Input
                    id="manual_amount"
                    name="amount_nok"
                    type="number"
                    min="1"
                    step="1"
                    required
                    defaultValue={suggestedAmount ?? ""}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual_paid_at" required>
                    Betalt dato
                  </Label>
                  <Input
                    id="manual_paid_at"
                    name="paid_at"
                    type="date"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual_method" required>
                    Måte
                  </Label>
                  <select
                    id="manual_method"
                    name="method"
                    required
                    defaultValue="kontant"
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                  >
                    <option value="kontant">Kontant</option>
                    <option value="bank">Bankoverføring</option>
                    <option value="annet">Annet</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual_note">Notat</Label>
                  <Input
                    id="manual_note"
                    name="note"
                    type="text"
                    placeholder="Valgfritt"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={pending || !currentClass}
                  className="lg:col-start-4"
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Registrer
                </Button>
              </form>
            )}

            <p className="text-xs text-muted-foreground">
              Delbetaling er lov - skriv beløpet som faktisk kom inn.
            </p>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="justify-self-start"
            onClick={() => setFormOpen(true)}
            disabled={!currentClass}
          >
            <Plus className="size-4" />
            Registrer betaling
          </Button>
        )}

        {yearPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ingen betalinger dette skoleåret.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {yearPayments.map((payment) => {
              const voided = Boolean(payment.voided_at);
              const note = shortNote(payment);
              const shown = payment.allocatedAmount ?? payment.amount;
              return (
                <li
                  key={payment.id}
                  className={voided ? "opacity-55" : undefined}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                  <span className="w-14 shrink-0 text-sm text-muted-foreground">
                    {formatDate(payment.paid_at ?? payment.created_at)}
                  </span>

                  <span
                    className={`w-24 shrink-0 font-medium ${
                      voided ? "line-through" : ""
                    }`}
                  >
                    {formatNok(shown)}
                  </span>

                  <Badge variant="outline" className="shrink-0">
                    {methodLabels[payment.method] ?? payment.method}
                  </Badge>

                  {voided ? (
                    <Badge variant="destructive" className="shrink-0">
                      Annullert
                    </Badge>
                  ) : payment.status !== "fanget" ? (
                    <Badge variant="secondary" className="shrink-0">
                      {statusLabels[payment.status] ?? payment.status}
                    </Badge>
                  ) : null}

                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {note}
                    {payment.sharedWith ? (
                      <span
                        className="ml-2 inline-flex items-center gap-1"
                        title={`Del av en samlet betaling på ${formatNok(
                          payment.amount,
                        )} for ${payment.sharedWith} barn`}
                      >
                        <Users className="size-3" />
                        {payment.sharedWith} barn
                      </span>
                    ) : null}
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Vis detaljer"
                    aria-expanded={expanded === payment.id}
                    onClick={() =>
                      setExpanded((current) =>
                        current === payment.id ? null : payment.id,
                      )
                    }
                  >
                    <ChevronDown
                      className={`size-4 transition-transform ${
                        expanded === payment.id ? "rotate-180" : ""
                      }`}
                    />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Handlinger"
                          disabled={pending}
                        />
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {payment.method === "vipps" ? (
                        <>
                          <DropdownMenuItem onClick={() => copyLink(payment.id)}>
                            <Link2 className="size-4" />
                            Kopier betalingslenke
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              run(
                                () => sendPaymentLink(payment.id),
                                "Betalingslenke sendt",
                              )
                            }
                          >
                            <Mail className="size-4" />
                            Send på e-post
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              run(
                                () => syncPaymentStatus(payment.id),
                                "Status oppdatert",
                              )
                            }
                          >
                            <RefreshCw className="size-4" />
                            Hent status fra Vipps
                          </DropdownMenuItem>
                          {payment.status === "autorisert" ? (
                            <DropdownMenuItem
                              onClick={() =>
                                run(
                                  () => captureVippsPayment(payment.id),
                                  "Betaling kapret",
                                )
                              }
                            >
                              <Check className="size-4" />
                              Kapre reserverte penger
                            </DropdownMenuItem>
                          ) : null}
                          {payment.status === "opprettet" ||
                          payment.status === "autorisert" ? (
                            <DropdownMenuItem
                              onClick={() =>
                                run(
                                  () => cancelVippsPayment(payment.id),
                                  "Betaling avbrutt",
                                )
                              }
                            >
                              <Ban className="size-4" />
                              Avbryt betaling
                            </DropdownMenuItem>
                          ) : null}
                          {payment.status === "fanget" ? (
                            <DropdownMenuItem
                              onClick={() =>
                                run(
                                  () => refundVippsPayment(payment.id),
                                  "Betaling refundert",
                                )
                              }
                            >
                              <Undo2 className="size-4" />
                              Refunder til foresatt
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                        </>
                      ) : null}

                      {voided ? (
                        <DropdownMenuItem
                          onClick={() =>
                            run(
                              () => restorePayment(payment.id),
                              "Annullering angret",
                            )
                          }
                        >
                          <RotateCcw className="size-4" />
                          Angre annullering
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() =>
                            run(
                              () => voidPayment(payment.id, "Annullert manuelt"),
                              "Betaling annullert",
                            )
                          }
                        >
                          <EyeOff className="size-4" />
                          Annuller (tell ikke med)
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() =>
                          run(
                            () => deletePayment(payment.id),
                            "Betaling slettet",
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                        Slett fra listen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </div>

                  {expanded === payment.id ? (
                    <dl className="grid gap-x-6 gap-y-2 border-t bg-muted/40 px-3 py-3 text-sm sm:grid-cols-2">
                      <Detail label="Referanse" value={payment.reference} mono />
                      <Detail
                        label="Betalings-ID"
                        value={payment.psp_reference}
                        mono
                      />
                      <Detail
                        label="Beløp på betalingen"
                        value={formatNok(payment.amount)}
                      />
                      {payment.allocatedAmount != null &&
                      payment.allocatedAmount !== payment.amount ? (
                        <Detail
                          label="Andel for dette barnet"
                          value={formatNok(payment.allocatedAmount)}
                        />
                      ) : null}
                      <Detail
                        label="Status i Vipps"
                        value={payment.vipps_state}
                      />
                      <Detail
                        label="Betalingsmetode"
                        value={payment.vipps_payment_method}
                      />
                      <Detail label="E-post" value={payment.payer_email} />
                      <Detail label="Telefon" value={payment.payer_phone} />
                      <Detail
                        label="Beskrivelse"
                        value={payment.description}
                      />
                      <Detail
                        label="Trukket"
                        value={
                          payment.captured_at
                            ? new Date(payment.captured_at).toLocaleString(
                                "nb-NO",
                                { dateStyle: "short", timeStyle: "short" },
                              )
                            : null
                        }
                      />
                      <Detail
                        label="Sist synkronisert"
                        value={
                          payment.last_synced_at
                            ? new Date(payment.last_synced_at).toLocaleString(
                                "nb-NO",
                                { dateStyle: "short", timeStyle: "short" },
                              )
                            : null
                        }
                      />
                      {payment.void_reason ? (
                        <Detail
                          label="Annullert fordi"
                          value={payment.void_reason}
                        />
                      ) : null}
                    </dl>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
