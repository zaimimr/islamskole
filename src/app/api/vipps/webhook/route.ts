import { NextResponse, type NextRequest } from "next/server";
import { syncPaymentByReference } from "@/lib/payments-sync";

export async function POST(request: NextRequest) {
  let reference: string | null = null;
  try {
    const body = (await request.json()) as { reference?: string };
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
