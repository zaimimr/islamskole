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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type SchoolYearOption = { id: string; label: string };
export type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  schoolYear: string | null;
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
  bank: "Bankoverføring",
  annet: "Annet",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "fanget") return "default";
  if (status === "avbrutt" || status === "feilet") return "destructive";
  return "secondary";
}

function formatNok(ore: number) {
  return `${(ore / 100).toLocaleString("nb-NO")} kr`;
}

function formatAmount(amount: number, currency: string) {
  return `${(amount / 100).toLocaleString("nb-NO")} ${currency}`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("nb-NO", { dateStyle: "medium" });
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

  const currentClass = classByYear[year] ?? null;
  const balance = balancesByYear[year] ?? null;
  const remainingNok =
    balance && balance.remaining > 0 ? Math.round(balance.remaining / 100) : null;
  const suggestedAmount = remainingNok ?? defaultAmount ?? null;

  function handleCreate(formData: FormData) {
    formData.set("student_id", studentId);
    formData.set("school_year_id", year);
    startTransition(async () => {
      const result = await createVippsPayment(formData);
      if (result.ok) {
        toast.success(
          result.emailed
            ? `Betaling opprettet og sendt til ${result.emailedTo} foresatt${
                result.emailedTo === 1 ? "" : "e"
              } på e-post`
            : "Betaling opprettet (ingen foresatt har e-post - bruk Kopier/Send-knappene)",
        );
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
      <CardHeader>
        <CardTitle>Betaling</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <div className="grid gap-2">
            <Label htmlFor="payment_year" required>Skoleår</Label>
            <select
              id="payment_year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              {schoolYears.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Klasse</Label>
            {currentClass ? (
              <p className="flex h-9 items-center text-sm font-medium">
                {currentClass}
              </p>
            ) : (
              <p className="flex h-9 items-center text-sm text-destructive">
                Ikke plassert i en klasse dette skoleåret
              </p>
            )}
          </div>
        </div>

        {balance ? (
          <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Skyldig</p>
              <p className="text-2xl font-bold">{formatNok(balance.owed)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Betalt</p>
              <p className="text-2xl font-bold">{formatNok(balance.paid)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gjenstår</p>
              <p className="text-2xl font-bold">
                {formatNok(balance.remaining)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {balance.owed > 0 && balance.remaining <= 0
                  ? "Ferdig betalt"
                  : balance.paid > 0
                    ? "Delvis betalt"
                    : "Ikke betalt"}
              </p>
            </div>
          </div>
        ) : null}

        <form
          key={`vipps-${year}`}
          action={handleCreate}
          className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
        >
          <p className="text-sm font-medium sm:col-span-2 lg:col-span-4">
            Vipps-betaling
          </p>
          <div className="grid gap-2">
            <Label htmlFor="amount_nok" required>Beløp (kr)</Label>
            <Input
              id="amount_nok"
              name="amount_nok"
              type="number"
              min="1"
              step="1"
              required
              defaultValue={suggestedAmount ?? ""}
            />
            {remainingNok != null ? (
              <p className="text-xs text-muted-foreground">
                Foreslått: restbeløpet
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={pending || !currentClass}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Opprett betaling
          </Button>
        </form>

        <form
          key={`manual-${year}`}
          action={handleManual}
          className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
        >
          <p className="text-sm font-medium sm:col-span-2 lg:col-span-4">
            Registrer betaling fra annen kilde
          </p>
          <div className="grid gap-2">
            <Label htmlFor="manual_amount" required>Beløp (kr)</Label>
            <Input
              id="manual_amount"
              name="amount_nok"
              type="number"
              min="1"
              step="1"
              required
              defaultValue={suggestedAmount ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              Delbetaling er lov - skriv beløpet som faktisk kom inn
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="manual_paid_at" required>Betalt dato</Label>
            <Input
              id="manual_paid_at"
              name="paid_at"
              type="date"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="manual_method" required>Betalingsmåte</Label>
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
            variant="secondary"
            disabled={pending || !currentClass}
            className="lg:col-start-4"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Registrer betaling
          </Button>
        </form>

        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ingen betalinger ennå.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Beløp</TableHead>
                <TableHead>Skoleår</TableHead>
                <TableHead>Måte</TableHead>
                <TableHead>Betaler</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dato</TableHead>
                <TableHead className="text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => {
                const isManual = payment.method !== "vipps";
                const voided = Boolean(payment.voided_at);
                return (
                  <TableRow
                    key={payment.id}
                    className={voided ? "opacity-55" : undefined}
                  >
                    <TableCell className="font-medium">
                      <span className={voided ? "line-through" : undefined}>
                        {formatAmount(payment.amount, payment.currency)}
                      </span>
                    </TableCell>
                    <TableCell>{payment.schoolYear ?? "-"}</TableCell>
                    <TableCell>
                      {methodLabels[payment.method] ?? payment.method}
                    </TableCell>
                    <TableCell className="max-w-48">
                      {payment.payer_name || payment.payer_phone ? (
                        <span className="text-sm">
                          {payment.payer_name ?? payment.payer_phone}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                      {payment.reference ? (
                        <span
                          className="block truncate font-mono text-xs text-muted-foreground"
                          title={payment.reference}
                        >
                          {payment.reference}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {voided ? (
                        <Badge
                          variant="destructive"
                          title={payment.void_reason ?? "Annullert"}
                        >
                          Annullert
                        </Badge>
                      ) : (
                        <Badge variant={statusVariant(payment.status)}>
                          {statusLabels[payment.status] ?? payment.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDate(payment.paid_at ?? payment.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {voided ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Angre annullering"
                            title="Angre annullering - la betalingen telle igjen"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () => restorePayment(payment.id),
                                "Annullering angret",
                              )
                            }
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Annuller betaling"
                            title="Annuller - behold raden i loggen, men slutt å telle den"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () =>
                                  voidPayment(
                                    payment.id,
                                    "Annullert manuelt",
                                  ),
                                "Betaling annullert",
                              )
                            }
                          >
                            <EyeOff className="size-4" />
                          </Button>
                        )}
                        {isManual ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Slett betaling"
                            title="Slett betalingen fra listen"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () => deletePayment(payment.id),
                                "Betaling slettet",
                              )
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Kopier betalingslenke"
                              title="Kopier betalingslenke"
                              onClick={() => copyLink(payment.id)}
                            >
                              <Link2 className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Send lenke på e-post"
                              title="Send betalingslenke til foresatte på e-post"
                              disabled={pending}
                              onClick={() =>
                                run(
                                  () => sendPaymentLink(payment.id),
                                  "Betalingslenke sendt",
                                )
                              }
                            >
                              <Mail className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Synkroniser status"
                              title="Hent oppdatert status fra Vipps"
                              disabled={pending}
                              onClick={() =>
                                run(
                                  () => syncPaymentStatus(payment.id),
                                  "Status oppdatert",
                                )
                              }
                            >
                              <RefreshCw className="size-4" />
                            </Button>
                            {payment.status === "autorisert" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Kapre betaling"
                                title="Kapre betaling – trekk de reserverte pengene (gjør den til Betalt)"
                                disabled={pending}
                                onClick={() =>
                                  run(
                                    () => captureVippsPayment(payment.id),
                                    "Betaling kapret",
                                  )
                                }
                              >
                                <Check className="size-4" />
                              </Button>
                            ) : null}
                            {payment.status === "opprettet" ||
                            payment.status === "autorisert" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Avbryt betaling"
                                title="Avbryt betaling (kanseller før den er trukket)"
                                disabled={pending}
                                onClick={() =>
                                  run(
                                    () => cancelVippsPayment(payment.id),
                                    "Betaling avbrutt",
                                  )
                                }
                              >
                                <Ban className="size-4" />
                              </Button>
                            ) : null}
                            {payment.status === "fanget" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Refunder betaling"
                                title="Refunder betaling (betal tilbake til foresatt)"
                                disabled={pending}
                                onClick={() =>
                                  run(
                                    () => refundVippsPayment(payment.id),
                                    "Betaling refundert",
                                  )
                                }
                              >
                                <Undo2 className="size-4" />
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Slett betaling"
                              title="Slett betalingen fra listen"
                              disabled={pending}
                              onClick={() =>
                                run(
                                  () => deletePayment(payment.id),
                                  "Betaling slettet",
                                )
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
