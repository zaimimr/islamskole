export type ReconciliationStatus = "ny" | "matchet" | "sadaqa" | "familie" | "ignorert";

export const DEFAULT_VIPPS_REPORT_MSNS = ["60206", "1111805"];
export const DONATIONS_API_MSN = "60206";
export const DONATION_MSNS = ["60206", "24279"];

export const vippsAccountLabels: Record<string, string> = {
  "60206": "Islamskole donasjon",
  "24279": "Islamskole Sadaqah Bidrag",
  "610090": "Islamskole Elevbetaling",
  "1111805": "Islamskole web",
};

export function parseMsnList(value: string | null | undefined): string[] {
  const list = (value ?? "")
    .split(/[\s,;]+/)
    .map((item) => item.replace(/\D/g, ""))
    .filter(Boolean);
  return list.length > 0 ? [...new Set(list)] : DEFAULT_VIPPS_REPORT_MSNS;
}

export type MatchableTransaction = {
  source: "vipps" | "dnb";
  account: string;
  amount: number;
  bookedOn: string;
  counterpartyPhone: string | null;
  message: string | null;
  reference: string | null;
  pspReference: string | null;
};

export type MatchCandidate = {
  id: string;
  reference: string;
  pspReference: string | null;
  amount: number;
  paidOn: string | null;
  payerPhone: string | null;
};

export type Suggestion = {
  status: Exclude<ReconciliationStatus, "ny">;
  reason: string;
} | null;

export function suggestStatus(transaction: MatchableTransaction): Suggestion {
  if (transaction.source === "dnb") {
    if (/vipps/i.test(transaction.message ?? "") && transaction.amount > 0) {
      return {
        status: "ignorert",
        reason: "Utbetaling fra Vipps. Pengene er allerede med i Vipps-transaksjonene.",
      };
    }
    if (transaction.amount < 0) {
      return { status: "ignorert", reason: "Utgående betaling fra kontoen." };
    }
    return null;
  }
  if (transaction.amount < 0) {
    return { status: "ignorert", reason: "Refusjon i Vipps." };
  }
  if (DONATION_MSNS.includes(transaction.account)) {
    return { status: "sadaqa", reason: "Betalt til donasjonskontoen." };
  }
  return null;
}

function phoneDigits(value: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

export function phonesMatch(transactionPhone: string | null, payerPhone: string | null): boolean {
  const left = phoneDigits(transactionPhone);
  const right = phoneDigits(payerPhone);
  if (left.length < 4 || right.length < 4) return false;
  const length = Math.min(left.length, right.length, 8);
  return left.slice(-length) === right.slice(-length);
}

export type MatchResult = { paymentId: string; reason: string } | null;

export function findPaymentMatch(
  transaction: MatchableTransaction,
  candidates: MatchCandidate[],
  taken: ReadonlySet<string> = new Set(),
): MatchResult {
  if (transaction.amount <= 0) return null;
  const open = candidates.filter((candidate) => !taken.has(candidate.id));

  if (transaction.reference) {
    const byReference = open.find((candidate) => candidate.reference === transaction.reference);
    if (byReference) return { paymentId: byReference.id, reason: "Samme Vipps-referanse" };
  }
  if (transaction.pspReference) {
    const byPsp = open.find((candidate) => candidate.pspReference === transaction.pspReference);
    if (byPsp) return { paymentId: byPsp.id, reason: "Samme transaksjons-ID" };
  }
  if (transaction.counterpartyPhone) {
    const byPhone = open.filter(
      (candidate) =>
        candidate.amount === transaction.amount &&
        candidate.paidOn === transaction.bookedOn &&
        phonesMatch(transaction.counterpartyPhone, candidate.payerPhone),
    );
    if (byPhone.length === 1) {
      return { paymentId: byPhone[0].id, reason: "Samme beløp, dato og telefon" };
    }
  }
  return null;
}

export function matchAll<T extends MatchableTransaction & { id: string }>(
  transactions: T[],
  candidates: MatchCandidate[],
  taken: Iterable<string> = [],
): Map<string, { paymentId: string; reason: string }> {
  const used = new Set(taken);
  const result = new Map<string, { paymentId: string; reason: string }>();
  for (const transaction of transactions) {
    const match = findPaymentMatch(transaction, candidates, used);
    if (!match) continue;
    used.add(match.paymentId);
    result.set(transaction.id, match);
  }
  return result;
}
