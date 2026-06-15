import { NextResponse, type NextRequest } from "next/server";
import { syncPaymentByReference } from "@/lib/payments-sync";

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin)
    .replace(/\/$/, "");

  let state = "ukjent";
  if (reference) {
    try {
      state = (await syncPaymentByReference(reference)) ?? "ukjent";
    } catch {
      state = "ukjent";
    }
  }

  return NextResponse.redirect(`${siteUrl}/betaling/fullfort?state=${state}`);
}
