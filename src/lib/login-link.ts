import "server-only";
import { localePrefix } from "@/components/admin/paths";
import { safeNextPath } from "@/lib/auth-redirect";
import { sendLoginLinkEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

export async function findAuthUserId(email: string) {
  const { data, error } = await createAdminClient().rpc("auth_user_id_by_email", {
    p_email: email.trim(),
  });
  if (error) throw error;
  return data ?? null;
}

export async function sendLoginLink(input: {
  email: string;
  locale: "no" | "en";
  next?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (!site) return { ok: false, error: "NEXT_PUBLIC_SITE_URL mangler" };

  const admin = createAdminClient();
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { role: "member" },
  });
  if (createError && createError.code !== "email_exists") {
    console.error("login link createUser failed", createError);
    return { ok: false, error: "Kunne ikke opprette innlogging. Prøv igjen." };
  }

  const { data, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("login link generateLink failed", linkError);
    return { ok: false, error: "Kunne ikke lage innloggingslenken. Prøv igjen." };
  }

  const url = new URL(`${site}${localePrefix(input.locale)}/min-side/auth/bekreft`);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", "magiclink");
  const next = safeNextPath(input.next);
  if (next) url.searchParams.set("next", next);

  const sent = await sendLoginLinkEmail({ to: email, url: url.toString(), lang: input.locale });
  if (!sent) {
    console.error("login link email failed");
    return { ok: false, error: "Kunne ikke sende e-posten. Prøv igjen." };
  }
  return { ok: true };
}
