import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

function normalized(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("nb-NO").replace(/\s+/g, " ") || null;
}

export async function findReturningStudent(
  client: Client,
  child: {
    firstName: string | null;
    lastName: string | null;
    birthDate: string | null;
    guardianEmails: (string | null | undefined)[];
  },
): Promise<{ id: string; familyId: string | null } | null> {
  const firstName = normalized(child.firstName);
  const lastName = normalized(child.lastName);
  const emails = new Set(
    child.guardianEmails.map(normalized).filter((email): email is string =>
      Boolean(email),
    ),
  );
  if (!firstName || !lastName || !child.birthDate || emails.size === 0) {
    return null;
  }

  const { data: students } = await client
    .from("students")
    .select("id, family_id, child_first_name, child_last_name")
    .eq("child_birth_date", child.birthDate)
    .not("family_id", "is", null);
  const candidates = (students ?? []).filter(
    (student) =>
      normalized(student.child_first_name) === firstName &&
      normalized(student.child_last_name) === lastName,
  );
  if (candidates.length === 0) return null;

  const { data: links } = await client
    .from("family_guardians")
    .select("family_id, guardians(email)")
    .in(
      "family_id",
      candidates.map((student) => student.family_id as string),
    );
  const matchingFamilies = new Set(
    (links ?? [])
      .filter((link) =>
        emails.has(
          normalized(
            (link.guardians as unknown as { email: string | null } | null)
              ?.email,
          ) ?? "",
        ),
      )
      .map((link) => link.family_id),
  );
  const match = candidates.filter((student) =>
    matchingFamilies.has(student.family_id as string),
  );
  return match.length === 1
    ? { id: match[0].id, familyId: match[0].family_id }
    : null;
}

export function planPaymentTargets(
  existing: { studentId: string; amount: number }[],
  additions: { studentId: string; share: number }[],
  paymentAmount: number,
): { studentId: string; amount: number }[] {
  let left =
    paymentAmount - existing.reduce((sum, row) => sum + row.amount, 0);
  const taken = new Set(existing.map((row) => row.studentId));
  const planned: { studentId: string; amount: number }[] = [];
  for (const addition of additions) {
    if (taken.has(addition.studentId)) continue;
    const amount = Math.min(Math.max(addition.share, 0), left);
    if (amount <= 0) continue;
    taken.add(addition.studentId);
    planned.push({ studentId: addition.studentId, amount });
    left -= amount;
  }
  return planned;
}

export async function targetApplicationPayment(
  client: Client,
  studentId: string,
  applicationId: string,
  returning: boolean,
): Promise<void> {
  const { data: application } = await client
    .from("student_applications")
    .select("payment_id, payments(amount, status, school_year_id)")
    .eq("id", applicationId)
    .maybeSingle();
  const paymentId = application?.payment_id;
  const payment = application?.payments as {
    amount: number;
    status: string;
    school_year_id: string | null;
  } | null;
  if (!paymentId || !payment || payment.status !== "fanget") return;
  if (payment.amount <= 0 || !payment.school_year_id) return;

  const { data: targets } = await client
    .from("payment_targets")
    .select("student_id, amount")
    .eq("payment_id", paymentId);
  if (!returning && (targets ?? []).length === 0) return;

  const { data: linked } = await client
    .from("students")
    .select("id, student_applications!students_application_id_fkey!inner(payment_id)")
    .eq("student_applications.payment_id", paymentId);
  const candidates = [
    ...(linked ?? []).map((row) => row.id).filter((id) => id !== studentId),
    studentId,
  ];

  const [{ data: balances }, { data: year }] = await Promise.all([
    client
      .from("student_balances")
      .select("student_id, owed")
      .eq("school_year_id", payment.school_year_id)
      .in("student_id", candidates),
    client
      .from("school_years")
      .select("fee")
      .eq("id", payment.school_year_id)
      .maybeSingle(),
  ]);
  const owed = new Map(
    (balances ?? []).map((row) => [row.student_id, row.owed ?? 0]),
  );
  const planned = planPaymentTargets(
    (targets ?? []).map((row) => ({
      studentId: row.student_id,
      amount: row.amount,
    })),
    candidates.map((id) => ({
      studentId: id,
      share: owed.get(id) ?? (year?.fee ?? 0) * 100,
    })),
    payment.amount,
  );
  if (planned.length === 0) return;
  await client.from("payment_targets").insert(
    planned.map((row) => ({
      payment_id: paymentId,
      student_id: row.studentId,
      amount: row.amount,
    })),
  );
}
