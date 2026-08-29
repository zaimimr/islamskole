import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ensureStudentFee, fetchBalance } from "@/lib/payment-ledger";

type Client = SupabaseClient<Database>;

export {
  SEMESTER_INSTALLMENT_ORE,
  layoutMonthlySlots,
  layoutSemesterSlots,
  layoutSlots,
  type InstallmentSlot,
  type PlanType,
} from "@/lib/installment-schedule";
import { layoutSlots } from "@/lib/installment-schedule";
import type { PlanType } from "@/lib/installment-schedule";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type DueInstallment = {
  id: string;
  studentId: string;
  amount: number;
};

export type InstallmentBatch = {
  planId: string;
  familyId: string;
  schoolYearId: string;
  dueDate: string;
  installments: DueInstallment[];
  totalAmount: number;
};

export async function getFamilyEnrolledStudents(
  client: Client,
  familyId: string,
  schoolYearId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("enrollments")
    .select("student_id, students!inner(family_id)")
    .eq("school_year_id", schoolYearId)
    .eq("status", "aktiv")
    .eq("students.family_id", familyId);

  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((row) => row.student_id as string);
  return [...new Set(ids)].sort();
}

type PlanRow = {
  id: string;
  family_id: string;
  school_year_id: string;
  plan_type: PlanType;
  monthly_amount: number | null;
  status: string;
  paused_at: string | null;
};

async function fetchPlan(client: Client, planId: string): Promise<PlanRow> {
  const { data, error } = await client
    .from("payment_plans")
    .select(
      "id, family_id, school_year_id, plan_type, monthly_amount, status, paused_at",
    )
    .eq("id", planId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Fant ikke betalingsplanen");
  return data as PlanRow;
}

async function fetchYearSchedule(client: Client, schoolYearId: string) {
  const { data, error } = await client
    .from("school_years")
    .select("sem1_due_on, sem2_due_on, monthly_due_day")
    .eq("id", schoolYearId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return {
    sem1DueOn: data?.sem1_due_on ?? null,
    sem2DueOn: data?.sem2_due_on ?? null,
    monthlyDueDay: data?.monthly_due_day ?? 15,
  };
}

async function outstandingHeldAmount(
  client: Client,
  planId: string,
  studentId: string,
): Promise<number> {
  const { data, error } = await client
    .from("installments")
    .select("amount")
    .eq("plan_id", planId)
    .eq("student_id", studentId)
    .in("status", ["sendt", "stoppet"]);

  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + (row.amount ?? 0), 0);
}

export async function generateInstallments(
  client: Client,
  planId: string,
): Promise<number> {
  const plan = await fetchPlan(client, planId);
  if (plan.status !== "aktiv") return 0;

  const year = await fetchYearSchedule(client, plan.school_year_id);
  const students = await getFamilyEnrolledStudents(
    client,
    plan.family_id,
    plan.school_year_id,
  );

  const { error: deleteError } = await client
    .from("installments")
    .delete()
    .eq("plan_id", plan.id)
    .eq("status", "planlagt");
  if (deleteError) throw new Error(deleteError.message);

  const rows: Database["public"]["Tables"]["installments"]["Insert"][] = [];

  for (const studentId of students) {
    await ensureStudentFee(client, studentId, plan.school_year_id);
    const balance = await fetchBalance(client, studentId, plan.school_year_id);
    const heldOutstanding = await outstandingHeldAmount(
      client,
      plan.id,
      studentId,
    );
    const target = Math.max(balance.remaining - heldOutstanding, 0);
    const slots = layoutSlots(plan.plan_type, target, year, plan.monthly_amount);

    for (const slot of slots) {
      rows.push({
        plan_id: plan.id,
        student_id: studentId,
        school_year_id: plan.school_year_id,
        due_date: slot.dueDate,
        amount: slot.amount,
        status: "planlagt",
      });
    }
  }

  if (rows.length > 0) {
    const { error } = await client.from("installments").insert(rows);
    if (error) throw new Error(error.message);
  }

  return rows.length;
}

export async function assignPaymentPlan(
  client: Client,
  input: {
    familyId: string;
    schoolYearId: string;
    planType: PlanType;
    monthlyAmount?: number | null;
    createdBy: string;
    note?: string | null;
  },
): Promise<string> {
  const { data: existing, error: existingError } = await client
    .from("payment_plans")
    .select("id")
    .eq("family_id", input.familyId)
    .eq("school_year_id", input.schoolYearId)
    .eq("status", "aktiv")
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const { error: cancelError } = await client
      .from("installments")
      .update({ status: "kansellert" })
      .eq("plan_id", existing.id)
      .in("status", ["planlagt", "stoppet"]);
    if (cancelError) throw new Error(cancelError.message);

    const { error: closeError } = await client
      .from("payment_plans")
      .update({ status: "avsluttet" })
      .eq("id", existing.id);
    if (closeError) throw new Error(closeError.message);
  }

  const { data: created, error } = await client
    .from("payment_plans")
    .insert({
      family_id: input.familyId,
      school_year_id: input.schoolYearId,
      plan_type: input.planType,
      monthly_amount:
        input.planType === "maanedlig" ? input.monthlyAmount ?? null : null,
      created_by: input.createdBy,
      note: input.note ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await generateInstallments(client, created.id);
  return created.id;
}

export async function rebuildPendingInstallments(
  client: Client,
  familyId: string,
  schoolYearId: string,
): Promise<void> {
  const { data, error } = await client
    .from("payment_plans")
    .select("id")
    .eq("family_id", familyId)
    .eq("school_year_id", schoolYearId)
    .eq("status", "aktiv")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return;

  await generateInstallments(client, data.id);
}

export async function rebuildPendingInstallmentsForStudent(
  client: Client,
  studentId: string,
  schoolYearId: string,
): Promise<void> {
  const { data, error } = await client
    .from("students")
    .select("family_id")
    .eq("id", studentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.family_id) return;

  await rebuildPendingInstallments(client, data.family_id, schoolYearId);
}

export async function findDueInstallmentBatches(
  client: Client,
  options: { leadDays?: number; limit?: number } = {},
): Promise<InstallmentBatch[]> {
  const leadDays = options.leadDays ?? 14;
  const limit = options.limit ?? 20;

  const horizon = new Date();
  horizon.setUTCDate(horizon.getUTCDate() + leadDays);

  const { data, error } = await client
    .from("installments")
    .select(
      "id, plan_id, student_id, school_year_id, due_date, amount, payment_plans!inner(family_id, status, paused_at)",
    )
    .eq("status", "planlagt")
    .gt("amount", 0)
    .lte("due_date", isoDate(horizon))
    .eq("payment_plans.status", "aktiv")
    .is("payment_plans.paused_at", null)
    .order("due_date")
    .limit(500);

  if (error) throw new Error(error.message);

  const batches = new Map<string, InstallmentBatch>();
  for (const row of data ?? []) {
    const plan = row.payment_plans as unknown as {
      family_id: string;
      status: string;
      paused_at: string | null;
    };
    const key = `${row.plan_id}:${row.due_date}`;
    let batch = batches.get(key);
    if (!batch) {
      if (batches.size >= limit) continue;
      batch = {
        planId: row.plan_id,
        familyId: plan.family_id,
        schoolYearId: row.school_year_id,
        dueDate: row.due_date,
        installments: [],
        totalAmount: 0,
      };
      batches.set(key, batch);
    }
    batch.installments.push({
      id: row.id,
      studentId: row.student_id,
      amount: row.amount,
    });
    batch.totalAmount += row.amount;
  }

  return [...batches.values()];
}
