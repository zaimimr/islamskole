import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export function smsPepper() {
  return process.env.SMS_CODE_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export async function allowSmsHit(key: string, limit: number, windowSeconds: number) {
  const { data, error } = await createAdminClient().rpc("portal_login_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("sms throttle failed", error);
    return false;
  }
  return data === true;
}

export async function allowSmsSend(phone: string) {
  if (!(await allowSmsHit(`sms-phone:${phone}`, 3, 600))) return false;
  if (!(await allowSmsHit(`sms-phone-day:${phone}`, 10, 86_400))) return false;
  if (!(await allowSmsHit("global:sms", 40, 3600))) {
    console.error("sms global limit reached");
    return false;
  }
  return true;
}
