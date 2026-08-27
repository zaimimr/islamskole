import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPaymentByReference } from "@/lib/payments-sync";
import { isVippsConfigured } from "@/lib/vipps";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PER_RUN = 40;
const LOOKBACK_DAYS = 120;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isVippsConfigured()) {
    return NextResponse.json({ error: "Vipps not configured" }, { status: 503 });
  }

  const since = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payments")
    .select("reference, status")
    .eq("method", "vipps")
    .in("status", ["opprettet", "autorisert"])
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const changed: { reference: string; from: string; to: string }[] = [];
  let failed = 0;

  for (const row of rows) {
    try {
      const status = await syncPaymentByReference(row.reference);
      if (status && status !== row.status) {
        changed.push({ reference: row.reference, from: row.status, to: status });
      }
    } catch (error) {
      failed++;
      console.error("Cron sync failed", { reference: row.reference, error });
    }
  }

  if (changed.length > 0) {
    console.log("Cron sync updated payments", changed);
  }

  return NextResponse.json({
    ok: true,
    checked: rows.length,
    changed: changed.length,
    failed,
  });
}
