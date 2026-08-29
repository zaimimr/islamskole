import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createPayment,
  getPayment,
  cancelPayment,
  type VippsPaymentState,
} from "@/lib/vipps";
import { buildPaymentDescriptor } from "@/lib/payment-descriptor";
import { rateLimit } from "@/lib/rate-limit";

const FRESH_WINDOW_MS = 9 * 60 * 1000;

type PaymentRow = {
  id: string;
  reference: string | null;
  amount: number;
  description: string | null;
  status: string;
  redirect_url: string | null;
  updated_at: string | null;
  vipps_state: string | null;
};

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/vipps/pay/[id]">,
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const result = rateLimit("vipps-pay:" + ip, { limit: 10, windowMs: 60_000 });
  if (!result.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)) },
      },
    );
  }

  const { id } = await ctx.params;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin)
    .replace(/\/$/, "");
  const done = (state: string) =>
    NextResponse.redirect(`${site}/betaling/fullfort?state=${state}`);

  const admin = createAdminClient();
  const { data } = await admin
    .from("payments")
    .select(
      "id, reference, amount, description, status, redirect_url, updated_at, vipps_state",
    )
    .eq("id", id)
    .maybeSingle();
  const payment = data as unknown as PaymentRow | null;
  if (!payment) return done("ukjent");

  if (payment.status === "fanget") return done("fanget");
  if (payment.status === "refundert") return done("ukjent");

  let confirmedState: VippsPaymentState | null = null;
  if (payment.reference) {
    try {
      const current = await getPayment(payment.reference);
      confirmedState = current.state;
      if (current.capturedAmount > 0) return done("fanget");
      if (current.state === "AUTHORIZED") return done("autorisert");
    } catch (error) {
      console.error("Vipps lookup failed before re-issue", {
        reference: payment.reference,
        error,
      });
    }
  }

  if (
    payment.redirect_url &&
    (confirmedState === "CREATED" || confirmedState === null) &&
    payment.updated_at &&
    Date.now() - new Date(payment.updated_at).getTime() < FRESH_WINDOW_MS
  ) {
    return NextResponse.redirect(payment.redirect_url);
  }

  const descriptor = await buildPaymentDescriptor(admin, id);
  const reference =
    payment.vipps_state === null &&
    payment.redirect_url === null &&
    payment.reference
      ? payment.reference
      : descriptor.reference;
  const returnUrl = `${site}/api/vipps/return?reference=${reference}`;
  let redirectUrl: string;
  try {
    const created = await createPayment({
      reference,
      amount: payment.amount,
      description: descriptor.description || payment.description || "Skolepenger",
      returnUrl,
      metadata: descriptor.metadata,
      orderLines: descriptor.orderLines,
    });
    redirectUrl = created.redirectUrl;
  } catch (error) {
    console.error("Vipps create failed", { paymentId: id, error });
    return done("ukjent");
  }

  if (payment.reference && confirmedState === "CREATED") {
    try {
      await cancelPayment(payment.reference);
    } catch (error) {
      console.error("Vipps cancel of superseded payment failed", {
        reference: payment.reference,
        error,
      });
    }
  }

  const { error: updateError } = await admin
    .from("payments")
    .update({
      reference,
      redirect_url: redirectUrl,
      vipps_state: "CREATED",
      status: "opprettet",
      description: descriptor.description || payment.description,
    } as never)
    .eq("id", id);
  if (updateError) {
    console.error("Vipps payment link persistence failed", {
      paymentId: id,
      error: updateError,
    });
    return done("ukjent");
  }

  return NextResponse.redirect(redirectUrl);
}
