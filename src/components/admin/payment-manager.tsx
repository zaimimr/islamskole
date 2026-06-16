"use client";

import { useTransition } from "react";
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
} from "lucide-react";
import {
  createVippsPayment,
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

export type EnrollmentOption = { id: string; label: string };
export type SchoolYearOption = { id: string; label: string };
export type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  schoolYear: string | null;
  description: string | null;
  status: string;
  redirect_url: string | null;
  created_at: string | null;
};

const statusLabels: Record<string, string> = {
  opprettet: "Venter",
  autorisert: "Autorisert",
  fanget: "Betalt",
  avbrutt: "Avbrutt",
  refundert: "Refundert",
  feilet: "Feilet",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "fanget") return "default";
  if (status === "avbrutt" || status === "feilet") return "destructive";
  return "secondary";
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
  enrollments,
  schoolYears,
  defaultSchoolYearId,
  defaultAmount,
  payments,
}: {
  studentId: string;
  enrollments: EnrollmentOption[];
  schoolYears: SchoolYearOption[];
  defaultSchoolYearId: string | null;
  defaultAmount: number | null;
  payments: PaymentRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleCreate(formData: FormData) {
    formData.set("student_id", studentId);
    startTransition(async () => {
      const result = await createVippsPayment(formData);
      if (result.ok) {
        toast.success("Betaling opprettet");
        try {
          await navigator.clipboard.writeText(result.redirectUrl);
          toast.success("Betalingslenke kopiert");
        } catch {
          void 0;
        }
        window.open(result.redirectUrl, "_blank", "noopener");
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

  function copyLink(url: string | null) {
    if (!url) {
      toast.error("Ingen betalingslenke");
      return;
    }
    navigator.clipboard.writeText(url);
    toast.success("Betalingslenke kopiert");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Betaling (Vipps)</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <form
          action={handleCreate}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
        >
          <div className="grid gap-2">
            <Label htmlFor="amount_nok">Beløp (kr)</Label>
            <Input
              id="amount_nok"
              name="amount_nok"
              type="number"
              min="1"
              step="1"
              required
              defaultValue={defaultAmount ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment_year">Skoleår</Label>
            <select
              id="payment_year"
              name="school_year_id"
              defaultValue={defaultSchoolYearId ?? ""}
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
            <Label htmlFor="enrollment_id">Klasse (valgfritt)</Label>
            <select
              id="enrollment_id"
              name="enrollment_id"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="">Ingen</option>
              {enrollments.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Opprett betaling
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
                <TableHead>Status</TableHead>
                <TableHead>Dato</TableHead>
                <TableHead className="text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">
                    {formatAmount(payment.amount, payment.currency)}
                  </TableCell>
                  <TableCell>{payment.schoolYear ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(payment.status)}>
                      {statusLabels[payment.status] ?? payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(payment.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Kopier betalingslenke"
                        onClick={() => copyLink(payment.redirect_url)}
                      >
                        <Link2 className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Send lenke på e-post"
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
                        disabled={pending}
                        onClick={() =>
                          run(() => deletePayment(payment.id), "Betaling slettet")
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
