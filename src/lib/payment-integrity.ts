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
): string {
  const digest = createHash("sha256")
    .update(`${operation}:${reference}:${amount ?? ""}`, "utf8")
    .digest("hex")
    .slice(0, 24);
  return `isk-${operation}-${digest}`;
}
