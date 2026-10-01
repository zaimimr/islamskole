"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { resolvePostLoginPath } from "@/lib/auth-redirect";
import { createLoginTokenHash } from "@/lib/login-link";
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
import { createClient } from "@/lib/supabase/server";

const MIN_FILL_MS = 2_000;

export type SmsLoginError = "invalid" | "rate_limited" | "disabled" | "wrong_code" | "unknown";
export type SmsLoginResult = { ok: true } | { ok: false; error: SmsLoginError };

async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function loginEmailForPhone(phone: string) {
  const { data, error } = await createAdminClient().rpc("sms_login_lookup", { p_phone: phone });
  if (error) {
    console.error("sms login lookup failed", error);
    return null;
  }
  return data ?? null;
}

function codeMessage(code: string, locale: "no" | "en") {
  return locale === "en"
    ? `Your Islamskole sign-in code is ${code}. It is valid for 10 minutes.`
    : `Innloggingskoden din for Islamskole er ${code}. Den gjelder i 10 minutter.`;
}

async function deliverCode(phone: string, locale: "no" | "en") {
  try {
    if (!(await loginEmailForPhone(phone))) return;
    if (!(await allowSmsSend(phone))) return;
    const code = generateLoginCode();
    const { error } = await createAdminClient().rpc("sms_login_issue", {
      p_phone: phone,
      p_code_hash: hashLoginCode(phone, code, smsPepper()),
      p_ttl_seconds: SMS_CODE_TTL_SECONDS,
    });
    if (error) {
      console.error("sms login issue failed", error);
      return;
    }
    if (!(await sendSms(phone, codeMessage(code, locale)))) console.error("sms login send failed");
  } catch (error) {
    console.error("sms login failed", error);
  }
}

export async function requestSmsLoginCode(formData: FormData): Promise<SmsLoginResult> {
  if (!smsEnabled() || !smsPepper()) return { ok: false, error: "disabled" };
  const ip = await clientIp();
  if (!(await allowSmsHit(`sms-ip:${ip}`, 5, 60))) return { ok: false, error: "rate_limited" };

  if (String(formData.get("hp_field_t") ?? "").trim()) return { ok: true };
  const loadedAt = Number(formData.get("loaded_at"));
  if (!Number.isFinite(loadedAt) || Date.now() - loadedAt < MIN_FILL_MS) return { ok: true };

  const phone = normalizeNorwegianMobile(String(formData.get("phone") ?? ""));
  if (!phone) return { ok: false, error: "invalid" };

  const locale = formData.get("locale") === "en" ? "en" : "no";
  after(() => deliverCode(phone, locale));
  return { ok: true };
}

export async function verifySmsLoginCode(formData: FormData): Promise<SmsLoginResult> {
  if (!smsEnabled() || !smsPepper()) return { ok: false, error: "disabled" };
  const ip = await clientIp();
  if (!(await allowSmsHit(`sms-verify-ip:${ip}`, 20, 600))) return { ok: false, error: "rate_limited" };

  const phone = normalizeNorwegianMobile(String(formData.get("phone") ?? ""));
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!phone || !isLoginCode(code)) return { ok: false, error: "invalid" };
  if (!(await allowSmsHit(`sms-verify-phone:${phone}`, 10, 86_400))) {
    return { ok: false, error: "rate_limited" };
  }

  const admin = createAdminClient();
  const { data: status, error } = await admin.rpc("sms_login_verify", {
    p_phone: phone,
    p_code_hash: hashLoginCode(phone, code, smsPepper()),
    p_max_attempts: SMS_CODE_MAX_ATTEMPTS,
  });
  if (error) {
    console.error("sms login verify failed", error);
    return { ok: false, error: "unknown" };
  }
  if (status !== "ok") return { ok: false, error: "wrong_code" };

  const email = await loginEmailForPhone(phone);
  if (!email) return { ok: false, error: "wrong_code" };
  const token = await createLoginTokenHash(email);
  if (!token.ok) return { ok: false, error: "unknown" };

  const supabase = await createClient();
  const { data, error: otpError } = await supabase.auth.verifyOtp({
    token_hash: token.tokenHash,
    type: "magiclink",
  });
  if (otpError || !data.user) {
    console.error("sms login session failed", otpError);
    return { ok: false, error: "unknown" };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  const locale = formData.get("locale") === "en" ? "en" : "no";
  revalidatePath("/", "layout");
  redirect(
    resolvePostLoginPath({
      next: String(formData.get("next") ?? "") || null,
      isAdmin: profile?.role === "admin",
      locale,
    }),
  );
}
