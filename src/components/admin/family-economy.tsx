"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  HandHeart,
  Loader2,
  Percent,
  Plus,
  Send,
} from "lucide-react";
import {
  assignPaymentPlanAction,
  approveSiblingDiscount,
  dismissSiblingSuggestion,
  endPaymentPlan,
  reopenInstallment,
  sendInstallmentNow,
  setPlanPaused,
  stopInstallment,
} from "@/app/[locale]/admin/familier/families-actions";
import {
  grantFeeAdjustment,
  recordSadaqaCoverage,
  revokeFeeAdjustment,
} from "@/app/[locale]/admin/students-actions";
import { formatNok } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type FamilyPlan = {
  id: string;
  planType: "full" | "semester" | "maanedlig";
  monthlyAmount: number | null;
  pausedAt: string | null;
};

export type FamilyInstallment = {
  id: string;
  studentName: string;
  dueDate: string;
  amount: number;
  status: string;
};

export type FamilyChildOption = {
  id: string;
  name: string;
};

export type FamilyAdjustment = {
  id: string;
  studentName: string;
  type: string;
  amount: number;
  note: string;
  teacherName: string | null;
};

export type TeacherOption = { id: string; name: string };

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  success: string;
  destructive?: boolean;
  action: () => Promise<{ ok: boolean; error?: string }>;
};

const planLabels: Record<string, string> = {
  full: "Full betaling",
  semester: "Semesterplan",
  maanedlig: "Månedlig",
};

const installmentStatusLabels: Record<string, string> = {
  planlagt: "Planlagt",
  sendt: "Sendt",
  betalt: "Betalt",
  kansellert: "Kansellert",
  stoppet: "Stoppet",
};

const installmentStatusClasses: Record<string, string> = {
  planlagt: "bg-[#DDEEF9] text-[#245D84]",
  sendt: "bg-[#FEEDCA] text-[#775108]",
  betalt: "bg-[#DCEDDD] text-[#216A2B]",
  kansellert: "bg-[#F0F0ED] text-[#4E5550]",
  stoppet: "bg-[#F9DEDB] text-[#8B2F2B]",
};

const adjustmentTypeLabels: Record<string, string> = {
  soskenrabatt: "Søskenrabatt",
  laererbarn: "Lærerbarn",
  frivillig: "Frivillig",
  annet: "Annet fritak",
};

function formatDueDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Oslo",
  });
}

export function FamilyEconomy({
  familyId,
  familyName,
  schoolYearId,
  schoolYearLabel,
  plan,
  installments,
  childrenOptions,
  siblingSuggestion,
  adjustments,
  teachers,
}: {
  familyId: string;
  familyName: string;
  schoolYearId: string;
  schoolYearLabel: string;
  plan: FamilyPlan | null;
  installments: FamilyInstallment[];
  childrenOptions: FamilyChildOption[];
  siblingSuggestion: boolean;
  adjustments: FamilyAdjustment[];
  teachers: TeacherOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [planType, setPlanType] = useState<string>(plan?.planType ?? "");
  const [monthlyAmount, setMonthlyAmount] = useState(
    plan?.monthlyAmount ? String(plan.monthlyAmount / 100) : "1000",
  );
  const [adjustmentType, setAdjustmentType] = useState("annet");
  const [siblingChild, setSiblingChild] = useState(
    childrenOptions[0]?.id ?? "",
  );

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

  function confirmAction() {
    if (!confirmation) return;
    startTransition(async () => {
      const result = await confirmation.action();
      if (result.ok) {
        toast.success(confirmation.success);
        setConfirmation(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "Noe gikk galt");
      }
    });
  }

  function submitPlan(formData: FormData) {
    formData.set("family_id", familyId);
    formData.set("school_year_id", schoolYearId);
    const submit = () =>
      assignPaymentPlanAction(formData) as Promise<{
        ok: boolean;
        error?: string;
      }>;

    if (plan) {
      setConfirmation({
        title: "Bytte betalingsplan?",
        description:
          "Kommende avdrag som ikke er sendt slettes og erstattes av den nye planen. Sendte og betalte avdrag beholdes.",
        confirmLabel: "Bytt plan",
        success: "Betalingsplanen er oppdatert",
        action: submit,
      });
    } else {
      run(submit, "Betalingsplanen er lagret");
    }
  }

  function submitAdjustment(formData: FormData) {
    const type = String(formData.get("type") ?? "");
    startTransition(async () => {
      const result =
        type === "sadaqa"
          ? await recordSadaqaCoverage(
              (() => {
                const sadaqa = new FormData();
                sadaqa.set("student_id", String(formData.get("student_id")));
                sadaqa.set("school_year_id", schoolYearId);
                sadaqa.set(
                  "amount_nok",
                  String(formData.get("amount_nok") ?? ""),
                );
                sadaqa.set("reason", String(formData.get("note") ?? ""));
                return sadaqa;
              })(),
            )
          : await grantFeeAdjustment(
              (() => {
                formData.set("school_year_id", schoolYearId);
                return formData;
              })(),
            );
      if (result.ok) {
        toast.success(
          type === "sadaqa" ? "Sadaqa-dekning registrert" : "Fradrag lagt til",
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const activeInstallments = installments.filter(
    (installment) => installment.status !== "kansellert",
  );

  return (
    <>
      <Card className="rounded-2xl border-0 ring-1 ring-[#E3DED3]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-heading text-xl">
            <CalendarClock aria-hidden="true" className="size-5" />
            Betalingsplan {schoolYearLabel}
          </CardTitle>
          {plan ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-[#DCEDDD] text-[#216A2B]">
                {planLabels[plan.planType]}
                {plan.planType === "maanedlig" && plan.monthlyAmount
                  ? ` ${formatNok(plan.monthlyAmount)}`
                  : ""}
              </Badge>
              {plan.pausedAt ? (
                <Badge className="bg-[#F9DEDB] text-[#8B2F2B]">
                  Utsendinger stoppet
                </Badge>
              ) : null}
            </div>
          ) : (
            <Badge variant="outline">Ingen plan</Badge>
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          <form action={submitPlan} className="grid gap-3">
            <div role="radiogroup" aria-label="Betalingsplan" className="grid gap-2">
              {[
                {
                  value: "full",
                  title: "Full betaling",
                  detail: "Hele skoleavgiften betales i én betaling.",
                },
                {
                  value: "semester",
                  title: "Semesterplan",
                  detail:
                    "2 000 kr ved påmelding, 1 500 kr innen 15. august og 1 500 kr innen 15. desember per barn.",
                },
                {
                  value: "maanedlig",
                  title: "Månedlig",
                  detail: "Fast beløp per barn hver måned til avgiften er dekket.",
                },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 ring-1 transition-colors ${
                    planType === option.value
                      ? "bg-[#DCEDDD] ring-[#9CC49A]"
                      : "bg-[#FAF9F5] ring-[#E8E3D9] hover:bg-[#F2F1EB]"
                  }`}
                >
                  <input
                    type="radio"
                    name="plan_type"
                    value={option.value}
                    checked={planType === option.value}
                    onChange={() => setPlanType(option.value)}
                    className="mt-1 size-4 accent-[#3C8F44]"
                  />
                  <span>
                    <span className="block font-bold">{option.title}</span>
                    <span className="block text-sm text-admin-muted">
                      {option.detail}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {planType === "maanedlig" ? (
              <div className="grid gap-1.5 sm:max-w-56">
                <Label htmlFor="monthly_amount">Månedsbeløp per barn</Label>
                <select
                  id="monthly_amount"
                  name="monthly_amount_nok"
                  value={monthlyAmount}
                  onChange={(event) => setMonthlyAmount(event.target.value)}
                  className="h-11 rounded-xl border border-input bg-transparent px-3 text-sm shadow-xs"
                >
                  <option value="1000">1 000 kr</option>
                  <option value="500">500 kr</option>
                </select>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={pending || !planType}
                className="min-h-11 rounded-xl px-4"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                {plan ? "Oppdater plan" : "Lagre plan"}
              </Button>
              {plan ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    className="min-h-11 rounded-xl px-4"
                    onClick={() =>
                      setConfirmation(
                        plan.pausedAt
                          ? {
                              title: "Starte automatiske utsendinger igjen?",
                              description:
                                "Kommende avdrag sendes automatisk på e-post når fristen nærmer seg.",
                              confirmLabel: "Start utsendinger",
                              success: "Utsendinger startet",
                              action: () => setPlanPaused(plan.id, false),
                            }
                          : {
                              title: "Stoppe automatiske utsendinger?",
                              description:
                                "Ingen betalingslenker sendes automatisk til familien før du starter utsendingene igjen. Beløpene blir stående som utestående.",
                              confirmLabel: "Stopp utsendinger",
                              success: "Utsendinger stoppet",
                              action: () => setPlanPaused(plan.id, true),
                            },
                      )
                    }
                  >
                    {plan.pausedAt ? "Start utsendinger" : "Stopp utsendinger"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    className="min-h-11 rounded-xl px-4 text-[#8B2F2B]"
                    onClick={() =>
                      setConfirmation({
                        title: "Avslutte betalingsplanen?",
                        description:
                          "Kommende avdrag kanselleres. Sendte og betalte avdrag beholdes, og utestående beløp må følges opp manuelt.",
                        confirmLabel: "Avslutt plan",
                        success: "Planen er avsluttet",
                        destructive: true,
                        action: () => endPaymentPlan(plan.id),
                      })
                    }
                  >
                    Avslutt plan
                  </Button>
                </>
              ) : null}
            </div>
          </form>

          {activeInstallments.length > 0 ? (
            <div className="grid gap-1.5 border-t border-[#ECE8DF] pt-3">
              <p className="text-xs font-bold tracking-[0.04em] uppercase text-admin-muted">
                Avdrag
              </p>
              <ul className="grid gap-1.5">
                {activeInstallments.map((installment) => (
                  <li
                    key={installment.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF9F5] px-3 py-2 text-sm ring-1 ring-[#E8E3D9]"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${installmentStatusClasses[installment.status] ?? "bg-[#F0F0ED] text-[#4E5550]"}`}
                      >
                        {installmentStatusLabels[installment.status] ??
                          installment.status}
                      </span>
                      <span className="font-bold">
                        {installment.studentName}
                      </span>
                      <span className="text-admin-muted">
                        Frist {formatDueDate(installment.dueDate)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-bold tabular-nums">
                        {formatNok(installment.amount)}
                      </span>
                      {installment.status === "planlagt" ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={pending}
                            className="h-8 rounded-lg px-2 text-xs font-bold"
                            onClick={() =>
                              setConfirmation({
                                title: "Sende avdraget nå?",
                                description: `Betalingslenke for ${formatNok(installment.amount)} med frist ${formatDueDate(installment.dueDate)} sendes til familien på e-post nå. Avdrag med samme frist sendes samlet.`,
                                confirmLabel: "Send nå",
                                success: "Avdraget er sendt",
                                action: () =>
                                  sendInstallmentNow(installment.id),
                              })
                            }
                          >
                            <Send className="size-3.5" />
                            Send nå
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={pending}
                            className="h-8 rounded-lg px-2 text-xs font-bold text-[#8B2F2B]"
                            onClick={() =>
                              setConfirmation({
                                title: `Stoppe avdraget på ${formatNok(installment.amount)}?`,
                                description: `Det sendes ingen automatisk betalingslenke for avdraget med frist ${formatDueDate(installment.dueDate)}. Beløpet blir stående som utestående til du gjør noe annet.`,
                                confirmLabel: "Stopp avdraget",
                                success: "Avdraget er stoppet",
                                destructive: true,
                                action: () => stopInstallment(installment.id),
                              })
                            }
                          >
                            Stopp
                          </Button>
                        </>
                      ) : installment.status === "stoppet" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={pending}
                          className="h-8 rounded-lg px-2 text-xs font-bold"
                          onClick={() =>
                            run(
                              () => reopenInstallment(installment.id),
                              "Avdraget er gjenåpnet",
                            )
                          }
                        >
                          Gjenåpne
                        </Button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-admin-muted">
                Betalingslenker sendes automatisk på e-post cirka 14 dager før
                frist.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {siblingSuggestion ? (
        <Card className="rounded-2xl border-0 bg-[#FFF8E9] ring-1 ring-[#E8D6AA]">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FEEDCA] text-[#775108]">
                <Percent aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="font-bold">
                  Familien kvalifiserer til søskenrabatt
                </p>
                <p className="text-sm text-[#6B5524]">
                  Familier med 3 eller flere barn kan få 1 500 kr i rabatt
                  (høstavdraget for ett barn).
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={siblingChild}
                onChange={(event) => setSiblingChild(event.target.value)}
                aria-label="Barn som får rabatten"
                className="h-11 rounded-xl border border-[#E8D6AA] bg-white px-3 text-sm"
              >
                {childrenOptions.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                disabled={pending || !siblingChild}
                className="min-h-11 rounded-xl px-4"
                onClick={() =>
                  setConfirmation({
                    title: `Godkjenn søskenrabatt for familien ${familyName}?`,
                    description:
                      "Kravet reduseres med 1 500 kr for ett barn, og avdraget 15. desember fjernes for barnet. Rabatten logges med begrunnelse.",
                    confirmLabel: "Godkjenn 1 500 kr rabatt",
                    success: "Søskenrabatt godkjent",
                    action: () => {
                      const formData = new FormData();
                      formData.set("family_id", familyId);
                      formData.set("school_year_id", schoolYearId);
                      formData.set("student_id", siblingChild);
                      return approveSiblingDiscount(formData);
                    },
                  })
                }
              >
                Godkjenn rabatt
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                className="min-h-11 rounded-xl px-3"
                onClick={() =>
                  run(
                    () => dismissSiblingSuggestion(familyId, schoolYearId),
                    "Forslaget er avvist",
                  )
                }
              >
                Avvis
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl border-0 ring-1 ring-[#E3DED3]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-xl">
            <HandHeart aria-hidden="true" className="size-5" />
            Rabatter, fritak og sadaqa
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {adjustments.length > 0 ? (
            <ul className="grid gap-1.5">
              {adjustments.map((adjustment) => (
                <li
                  key={adjustment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF9F5] px-3 py-2 text-sm ring-1 ring-[#E8E3D9]"
                >
                  <span>
                    <span className="font-bold">
                      {adjustment.studentName}:{" "}
                      {adjustmentTypeLabels[adjustment.type] ?? adjustment.type}
                      {adjustment.teacherName
                        ? ` (${adjustment.teacherName})`
                        : ""}
                    </span>{" "}
                    <span className="text-admin-muted">
                      − {formatNok(adjustment.amount)} · {adjustment.note}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    className="h-8 rounded-lg px-2 text-xs font-bold text-[#8B2F2B]"
                    onClick={() =>
                      setConfirmation({
                        title: "Opphev fradraget?",
                        description: `${adjustmentTypeLabels[adjustment.type] ?? adjustment.type} på ${formatNok(adjustment.amount)} for ${adjustment.studentName} fjernes, og beløpet legges tilbake på kravet. Historikken beholdes.`,
                        confirmLabel: "Opphev fradrag",
                        success: "Fradraget er opphevet",
                        destructive: true,
                        action: () =>
                          revokeFeeAdjustment(
                            adjustment.id,
                            "Opphevet fra familiesiden",
                          ),
                      })
                    }
                  >
                    Opphev
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-admin-muted">
              Ingen rabatter eller fritak i {schoolYearLabel}.
            </p>
          )}

          <form
            action={submitAdjustment}
            className="grid gap-3 rounded-xl bg-[#FAF9F5] p-3 ring-1 ring-[#E8E3D9] sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="family-adjustment-child">Barn</Label>
              <select
                id="family-adjustment-child"
                name="student_id"
                required
                className="h-11 rounded-xl border border-input bg-white px-3 text-sm shadow-xs"
              >
                {childrenOptions.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="family-adjustment-type">Type</Label>
              <select
                id="family-adjustment-type"
                name="type"
                value={adjustmentType}
                onChange={(event) => setAdjustmentType(event.target.value)}
                className="h-11 rounded-xl border border-input bg-white px-3 text-sm shadow-xs"
              >
                <option value="soskenrabatt">Søskenrabatt</option>
                <option value="laererbarn">Lærerbarn</option>
                <option value="frivillig">Frivillig</option>
                <option value="sadaqa">Sadaqa-dekning</option>
                <option value="annet">Annet fritak</option>
              </select>
            </div>
            {adjustmentType === "laererbarn" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="family-adjustment-teacher" required>
                  Lærer
                </Label>
                <select
                  id="family-adjustment-teacher"
                  name="teacher_guardian_id"
                  required
                  className="h-11 rounded-xl border border-input bg-white px-3 text-sm shadow-xs"
                >
                  <option value="">Velg lærer</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="family-adjustment-amount" required>
                Beløp (kr)
              </Label>
              <Input
                id="family-adjustment-amount"
                name="amount_nok"
                type="number"
                min="1"
                step="1"
                required
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="family-adjustment-note" required>
                Begrunnelse
              </Label>
              <Input
                id="family-adjustment-note"
                name="note"
                type="text"
                required
                placeholder="Hvorfor?"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <Button
                type="submit"
                variant="outline"
                disabled={pending}
                className="min-h-11 rounded-xl px-4"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Legg til
              </Button>
            </div>
            {adjustmentType === "sadaqa" ? (
              <p className="text-xs text-[#6B5524] sm:col-span-2 lg:col-span-5">
                Beløpet føres som betalt fra sadaqa-kontoen, ikke som rabatt.
                Bruken vises i sadaqa-oversikten.
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmation != null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <span className="mb-2 flex size-11 items-center justify-center rounded-full bg-[#F9DEDB] text-[#8B2F2B]">
              <AlertTriangle aria-hidden="true" className="size-5" />
            </span>
            <AlertDialogTitle className="font-heading text-2xl">
              {confirmation?.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="[&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:rounded-xl [&_[data-slot=button]]:px-4">
            <AlertDialogCancel disabled={pending}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {confirmation?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
