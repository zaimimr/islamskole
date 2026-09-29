import "server-only";
import { createHash } from "node:crypto";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PortalFamily } from "@/lib/portal/family-types";

export async function getMyFamilies(): Promise<PortalFamily[]> {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_my_families");
  if (error) {
    console.error("portal_my_families failed", error);
    return [];
  }
  return Array.isArray(data) ? (data as unknown as PortalFamily[]) : [];
}

export function hashEmailToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getEmailChangeByToken(token: string) {
  if (token.length < 20 || token.length > 200) return null;
  const { data, error } = await createAdminClient()
    .from("guardian_email_changes")
    .select("id, guardian_id, new_email, expires_at, confirmed_at")
    .eq("token_hash", hashEmailToken(token))
    .maybeSingle();
  if (error) {
    console.error("guardian_email_changes lookup failed", error);
    return null;
  }
  return data;
}

export function isEmailChangeOpen(change: { expires_at: string; confirmed_at: string | null }) {
  return !change.confirmed_at && new Date(change.expires_at).getTime() > Date.now();
}
