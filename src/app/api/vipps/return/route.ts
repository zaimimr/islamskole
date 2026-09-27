import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPaymentByReference } from "@/lib/payments-sync";
import { paymentFamilyId } from "@/lib/installment-billing";

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference");
  const localeParam = request.nextUrl.searchParams.get("locale");
  const locale = localeParam === "en" ? "en" : "no";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin)
    .replace(/\/$/, "");

  let state = "ukjent";
  let paymentId: string | null = null;
  if (reference) {
    try {
      state = (await syncPaymentByReference(reference)) ?? "ukjent";
    } catch {
      state = "ukjent";
    }
    const admin = createAdminClient();
    const { data } = await admin
      .from("payments")
      .select("id, student_id")
      .eq("reference", reference)
      .maybeSingle();
    paymentId = data?.id ?? null;
    const completed = state === "fanget" || state === "autorisert";
    if (data && completed && (localeParam === "en" || localeParam === "no")) {
      const familyId = await paymentFamilyId(admin, data);
      if (familyId) {
        const { error } = await admin
          .from("families")
          .update({ preferred_language: localeParam })
          .eq("id", familyId);
        if (error) {
          console.error("Storing preferred language failed", { familyId, error });
        }
      }
    }
  }

  const prefix = locale === "en" ? "/en" : "";
  const paymentParam = paymentId ? `&payment=${paymentId}` : "";
  return NextResponse.redirect(
    `${siteUrl}${prefix}/betaling/fullfort?state=${state}${paymentParam}`,
  );
}
