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
  } else if (!verifyVippsSignature(raw, request.headers, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let reference: string | null = null;
  try {
    const body = JSON.parse(raw) as { reference?: string };
    reference = typeof body.reference === "string" ? body.reference : null;
  } catch {
    reference = null;
  }

  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  try {
    await syncPaymentByReference(reference);
  } catch {
    return NextResponse.json({ error: "Sync failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
