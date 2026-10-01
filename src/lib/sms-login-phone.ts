import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getLoginPhone(userId: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from("sms_login_phones")
    .select("phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("sms login phone failed", error);
    return null;
  }
  return data?.phone ?? null;
}
