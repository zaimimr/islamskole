"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { sendSms, smsEnabled } from "@/lib/sms";
import { allowSmsHit, allowSmsSend, smsPepper } from "@/lib/sms-login-server";
import {
  SMS_CODE_MAX_ATTEMPTS,
  SMS_CODE_TTL_SECONDS,
  generateLoginCode,
  hashLoginCode,
  isLoginCode,
  normalizeNorwegianMobile,
} from "@/lib/sms-login-core";
import { createAdminClient } from "@/lib/supabase/admin";

export type SmsPhoneError = "invalid" | "rate_limited" | "disabled" | "wrong_code" | "unauthenticated" | "unknown";
export type SmsPhoneResult = { ok: true } | { ok: false; error: SmsPhoneError };

function linkMessage(code: string, locale: "no" | "en") {
  return locale === "en"
    ? `Your code to turn on SMS sign-in for Islamskole is ${code}. It is valid for 10 minutes.`
    : `Koden for å slå på SMS-innlogging hos Islamskole er ${code}. Den gjelder i 10 minutter.`;
}

export async function requestPhoneLinkCode(formData: FormData): Promise<SmsPhoneResult> {
  if (!smsEnabled() || !smsPepper()) return { ok: false, error: "disabled" };
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const phone = normalizeNorwegianMobile(String(formData.get("phone") ?? ""));
  if (!phone) return { ok: false, error: "invalid" };
  if (!(await allowSmsHit(`sms-link-user:${user.id}`, 5, 3600))) return { ok: false, error: "rate_limited" };
  if (!(await allowSmsSend(phone))) return { ok: false, error: "rate_limited" };

  const code = generateLoginCode();
  const { error } = await createAdminClient().rpc("sms_login_issue", {
    p_phone: phone,
    p_code_hash: hashLoginCode(phone, code, smsPepper()),
    p_ttl_seconds: SMS_CODE_TTL_SECONDS,
    p_user_id: user.id,
  });
  if (error) {
    console.error("sms link issue failed", error);
    return { ok: false, error: "unknown" };
  }
  const locale = formData.get("locale") === "en" ? "en" : "no";
  if (!(await sendSms(phone, linkMessage(code, locale)))) {
    console.error("sms link send failed");
    return { ok: false, error: "unknown" };
  }
  return { ok: true };
}

export async function confirmPhoneLink(formData: FormData): Promise<SmsPhoneResult> {
  if (!smsEnabled() || !smsPepper()) return { ok: false, error: "disabled" };
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const phone = normalizeNorwegianMobile(String(formData.get("phone") ?? ""));
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!phone || !isLoginCode(code)) return { ok: false, error: "invalid" };
  if (!(await allowSmsHit(`sms-link-verify-user:${user.id}`, 10, 86_400))) {
    return { ok: false, error: "rate_limited" };
  }

  const { data: status, error } = await createAdminClient().rpc("sms_login_link_phone", {
    p_user_id: user.id,
    p_phone: phone,
    p_code_hash: hashLoginCode(phone, code, smsPepper()),
    p_max_attempts: SMS_CODE_MAX_ATTEMPTS,
  });
  if (error) {
    console.error("sms link verify failed", error);
    return { ok: false, error: "unknown" };
  }
  if (status !== "ok") return { ok: false, error: "wrong_code" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeLoginPhone(): Promise<SmsPhoneResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthenticated" };
  const { error } = await createAdminClient().from("sms_login_phones").delete().eq("user_id", user.id);
  if (error) {
    console.error("sms link remove failed", error);
    return { ok: false, error: "unknown" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
