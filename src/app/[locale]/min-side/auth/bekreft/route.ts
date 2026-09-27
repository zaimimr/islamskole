import { NextResponse, type NextRequest } from "next/server";
import { localePrefix } from "@/components/admin/paths";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set(["magiclink", "email"]);

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/[locale]/min-side/auth/bekreft">,
) {
  const { locale } = await ctx.params;
  const base = `${localePrefix(locale)}/min-side`;
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") ?? "";

  if (tokenHash && OTP_TYPES.has(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "magiclink" | "email",
    });
    if (!error) {
      return NextResponse.redirect(new URL(base, request.nextUrl.origin));
    }
  }

  return NextResponse.redirect(
    new URL(`${base}/logg-inn?lenke=ugyldig`, request.nextUrl.origin),
  );
}
