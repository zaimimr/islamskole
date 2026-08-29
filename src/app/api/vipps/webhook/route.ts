import { NextResponse, type NextRequest } from "next/server";
import { syncPaymentByReference } from "@/lib/payments-sync";
import {
  parseVippsWebhookPayload,
  verifyVippsSignature,
} from "@/lib/vipps-webhook";

let warnedSignatureDisabled = false;

export async function POST(request: NextRequest) {
  const raw = await request.text();

  const secret = process.env.VIPPS_WEBHOOK_SECRET;
  const allowsUnsignedLocalWebhook = process.env.NODE_ENV === "development";
  if (!secret) {
    if (!allowsUnsignedLocalWebhook) {
      console.error("VIPPS_WEBHOOK_SECRET is required outside local development");
      return NextResponse.json(
        { error: "Webhook verification unavailable" },
        { status: 503 },
      );
    }
    if (!warnedSignatureDisabled) {
      warnedSignatureDisabled = true;
      console.warn(
        "VIPPS_WEBHOOK_SECRET is not set; unsigned webhooks are accepted in local development.",
      );
    }
  } else {
    const valid = verifyVippsSignature({
      rawBody: raw,
      method: request.method,
      pathAndQuery: `${request.nextUrl.pathname}${request.nextUrl.search}`,
      headers: request.headers,
      secret,
    });
    if (!valid) {
      console.error("Vipps webhook signature rejected", {
        path: request.nextUrl.pathname,
        host: request.headers.get("host"),
        forwardedHost: request.headers.get("x-forwarded-host"),
        hasDate: Boolean(request.headers.get("x-ms-date")),
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const expectedMsn = process.env.VIPPS_MSN;
  if (!expectedMsn) {
    console.error("VIPPS_MSN is required for webhook validation");
    return NextResponse.json(
      { error: "Webhook verification unavailable" },
      { status: 503 },
    );
  }

  const payload = parseVippsWebhookPayload(raw, expectedMsn);
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const status = await syncPaymentByReference(payload.reference);
    console.log("Vipps webhook handled", {
      reference: payload.reference,
      eventName: payload.name,
      status,
    });
  } catch (error) {
    console.error("Vipps webhook sync failed", {
      reference: payload.reference,
      eventName: payload.name,
      error,
    });
    return NextResponse.json({ error: "Sync failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
