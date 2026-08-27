import { NextResponse, type NextRequest } from "next/server";
import { syncPaymentByReference } from "@/lib/payments-sync";
import { verifyVippsSignature } from "@/lib/vipps-webhook";

let warnedSignatureDisabled = false;

export async function POST(request: NextRequest) {
  const raw = await request.text();

  const secret = process.env.VIPPS_WEBHOOK_SECRET;
  if (!secret) {
    if (!warnedSignatureDisabled) {
      warnedSignatureDisabled = true;
      console.warn(
        "VIPPS_WEBHOOK_SECRET is not set; webhook signature validation is disabled.",
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

  let reference: string | null = null;
  let eventName: string | null = null;
  try {
    const body = JSON.parse(raw) as { reference?: string; name?: string };
    reference = typeof body.reference === "string" ? body.reference : null;
    eventName = typeof body.name === "string" ? body.name : null;
  } catch {
    reference = null;
  }

  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  try {
    const status = await syncPaymentByReference(reference);
    console.log("Vipps webhook handled", { reference, eventName, status });
  } catch (error) {
    console.error("Vipps webhook sync failed", { reference, eventName, error });
    return NextResponse.json({ error: "Sync failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
