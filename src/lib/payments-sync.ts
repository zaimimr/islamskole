import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPayment, type VippsPaymentState } from "@/lib/vipps";

export function mapVippsState(
  state: VippsPaymentState,
  capturedAmount: number,
): string {
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

export async function syncPaymentByReference(
  reference: string,
): Promise<string | null> {
  const result = await getPayment(reference);
  const status = mapVippsState(result.state, result.capturedAmount);

  const update: Record<string, unknown> = {
    status,
    vipps_state: result.state,
  };
  if (status === "fanget") update.captured_at = new Date().toISOString();

  const admin = createAdminClient();
  await admin
    .from("payments")
    .update(update as never)
    .eq("reference", reference);

  return status;
}
