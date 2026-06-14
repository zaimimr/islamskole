import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const handleI18n = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = handleI18n(request) ?? NextResponse.next();
  return updateSession(request, response);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
