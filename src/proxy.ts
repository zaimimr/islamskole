import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const handleI18n = createMiddleware(routing);

const ADMIN_PATH = /^\/(?:no\/)?admin(?:\/|$)/;
const ENGLISH_ADMIN_PATH = /^\/en\/(admin)(\/.*)?$/;
const OLD_LOGIN_PATH = /^\/(?:(no|en)\/)?login(?:\/nytt-passord)?\/?$/;

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const oldLogin = OLD_LOGIN_PATH.exec(pathname);
  if (oldLogin) {
    const url = request.nextUrl.clone();
    url.pathname = `${oldLogin[1] === "en" ? "/en" : ""}/min-side/logg-inn`;
    url.search = "";
    const next = request.nextUrl.searchParams.get("next");
    if (next) url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  const english = ENGLISH_ADMIN_PATH.exec(pathname);
  if (english) {
    const url = request.nextUrl.clone();
    url.pathname = `/${english[1]}${english[2] ?? ""}`;
    return NextResponse.redirect(url);
  }

  const response = handleI18n(request) ?? NextResponse.next();

  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    (request.headers.get("sec-purpose") ?? "").includes("prefetch");
  if (isPrefetch) return response;

  const session = await updateSession(request, response);

  if (
    ADMIN_PATH.test(pathname) &&
    !session.user &&
    request.method === "GET" &&
    !request.headers.has("next-action")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/min-side/logg-inn";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return session.response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
