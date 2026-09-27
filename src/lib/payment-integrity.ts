import { createHash } from "node:crypto";

export type PaymentProviderState =
  | "CREATED"
  | "ABORTED"
  | "EXPIRED"
  | "AUTHORIZED"
  | "TERMINATED";

export function netPaidAmount(
  capturedAmount: number,
  refundedAmount: number,
): number {
  return Math.max(capturedAmount - refundedAmount, 0);
}

export function mapVippsPaymentState(
  state: PaymentProviderState,
  capturedAmount: number,
  refundedAmount: number,
): string {
  if (capturedAmount > 0 && refundedAmount >= capturedAmount) {
    return "refundert";
  }
  if (capturedAmount > 0) return "fanget";
  switch (state) {
    case "AUTHORIZED":
      return "autorisert";
    case "ABORTED":
    case "EXPIRED":
    case "TERMINATED":
      return "avbrutt";
    default:
      return "opprettet";
  }
}

export function vippsIdempotencyKey(
  operation: "create" | "capture" | "refund" | "cancel",
  reference: string,
  amount?: number,
  nonce?: string,
): string {
  const digest = createHash("sha256")
    .update(
      `${operation}:${reference}:${amount ?? ""}${nonce ? `:${nonce}` : ""}`,
      "utf8",
    )
    .digest("hex")
    .slice(0, 24);
  return `isk-${operation}-${digest}`;
}

export type BillingBalance = { owed: number; remaining: number } | null;

export type BillingExclusion = "fritatt" | "betalt" | "plan" | "uten_pris";

export type BillingDecision =
  | { bill: true; amount: number }
  | { bill: false; reason: BillingExclusion };

export function billingDecision(input: {
  balance: BillingBalance;
  onPlan?: boolean;
  fallbackAmount?: number | null;
}): BillingDecision {
  if (input.onPlan) return { bill: false, reason: "plan" };
  const balance = input.balance;
  if (balance) {
    if (balance.owed <= 0) return { bill: false, reason: "fritatt" };
    if (balance.remaining <= 0) return { bill: false, reason: "betalt" };
    return { bill: true, amount: balance.remaining };
  }
  const fallback = input.fallbackAmount ?? 0;
  if (fallback <= 0) return { bill: false, reason: "uten_pris" };
  return { bill: true, amount: fallback };
}

export type BatchCandidate = {
  studentId: string;
  name: string;
  className: string | null;
  familyKey: string;
  familyName: string | null;
  balance: BillingBalance;
  fallbackAmount: number | null;
  onPlan: boolean;
  hasOpenLink: boolean;
  hasRecipients: boolean;
};

export type BatchExclusionReason = BillingExclusion | "apen_lenke" | "ingen_epost";

export type BatchChild = {
  studentId: string;
  name: string;
  className: string | null;
  amount: number;
};

export type BatchFamily = {
  familyKey: string;
  familyName: string | null;
  children: BatchChild[];
  amount: number;
};

export type BatchExcluded = {
  studentId: string;
  name: string;
  familyName: string | null;
  reason: BatchExclusionReason;
};

export function planFamilyBatch(candidates: BatchCandidate[]): {
  families: BatchFamily[];
  excluded: BatchExcluded[];
} {
  const families = new Map<string, BatchFamily>();
  const excluded: BatchExcluded[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (seen.has(candidate.studentId)) continue;
    seen.add(candidate.studentId);

    const exclude = (reason: BatchExclusionReason) =>
      excluded.push({
        studentId: candidate.studentId,
        name: candidate.name,
        familyName: candidate.familyName,
        reason,
      });

    const decision = billingDecision({
      balance: candidate.balance,
      onPlan: candidate.onPlan,
      fallbackAmount: candidate.fallbackAmount,
    });
    if (!decision.bill) {
      exclude(decision.reason);
      continue;
    }
    if (candidate.hasOpenLink) {
      exclude("apen_lenke");
      continue;
    }
    if (!candidate.hasRecipients) {
      exclude("ingen_epost");
      continue;
    }

    let family = families.get(candidate.familyKey);
    if (!family) {
      family = {
        familyKey: candidate.familyKey,
        familyName: candidate.familyName,
        children: [],
        amount: 0,
      };
      families.set(candidate.familyKey, family);
    }
    family.children.push({
      studentId: candidate.studentId,
      name: candidate.name,
      className: candidate.className,
      amount: decision.amount,
    });
    family.amount += decision.amount;
  }

  return { families: [...families.values()], excluded };
}

export type ChildTarget = { studentId: string; amount: number };

export function capTargetsAtRemaining(
  targets: ChildTarget[],
  remainingByStudent: Map<string, number>,
): ChildTarget[] {
  return targets
    .map((target) => ({
      studentId: target.studentId,
      amount: Math.min(
        target.amount,
        Math.max(remainingByStudent.get(target.studentId) ?? 0, 0),
      ),
    }))
    .filter((target) => target.amount > 0);
}

export async function mapInChunks<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    const chunk = items.slice(index, index + size);
    results.push(...(await Promise.all(chunk.map(fn))));
  }
  return results;
}
