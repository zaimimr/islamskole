import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CalendarRange, Search, UserRound } from "lucide-react";
import { getIsAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { SidebarNav } from "@/components/admin/sidebar-nav";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { adminBasePath, loginPath } from "@/components/admin/paths";

async function getActiveSchoolYear() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_years")
    .select("label")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return { label: null, unavailable: true };
  }

  return {
    label: (data as { label: string } | null)?.label ?? null,
    unavailable: false,
  };
}

export default async function AdminLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  const [isAdmin, schoolYear] = await Promise.all([
    getIsAdmin(),
    getActiveSchoolYear(),
  ]);
  if (!isAdmin) {
    redirect(loginPath(locale));
  }

  const basePath = adminBasePath(locale);
  const resolvedLoginPath = loginPath(locale);
  const yearLabel = schoolYear.unavailable
    ? "Skoleår utilgjengelig"
    : (schoolYear.label ?? "Velg skoleår");

  return (
    <div
      data-admin-shell
      className="flex min-h-dvh w-full overflow-x-hidden bg-[#FCFAF5] text-[#18201A]"
    >
      <aside className="sticky top-0 hidden h-dvh w-[16.5rem] shrink-0 flex-col border-r border-[#E9E5DC] bg-[#FEFEFE] px-4 py-5 lg:flex">
        <Link
          href={basePath}
          aria-label="Gå til arbeidsflaten"
          className="mb-7 inline-flex w-fit rounded-lg px-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Image
            src="/brand/logo.png"
            alt="Islamskole Bærum"
            width={125}
            height={51}
            priority
          />
        </Link>
        <SidebarNav basePath={basePath} />
        <div className="mt-3 border-t border-[#E9E5DC] pt-3">
          <SignOutButton
            loginHref={resolvedLoginPath}
            className="min-h-11 rounded-xl px-3 text-foreground/72 hover:bg-[#F2F1EB]"
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[#E9E5DC] bg-[#FCFAF5]/95 px-4 py-3 supports-backdrop-filter:backdrop-blur-md sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[96rem] flex-wrap items-center gap-3 lg:flex-nowrap">
            <AdminMobileNav basePath={basePath} loginHref={resolvedLoginPath} />
            <Link
              href={basePath}
              aria-label="Gå til arbeidsflaten"
              className="mr-auto inline-flex min-h-11 items-center rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
            >
              <Image
                src="/brand/logo.png"
                alt="Islamskole Bærum"
                width={96}
                height={39}
                priority
              />
            </Link>

            <Link
              href={`${basePath}/skolear`}
              className="order-2 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#E4E1D8] bg-white px-3 text-sm font-bold text-foreground outline-none transition-colors hover:border-[#BFD9C2] hover:bg-[#F7FBF7] focus-visible:ring-3 focus-visible:ring-ring/50 lg:order-1 lg:min-w-[10.5rem] lg:px-4"
            >
              <CalendarRange
                aria-hidden="true"
                className="size-4 text-[#3C8F44]"
              />
              <span className="sr-only">Aktivt skoleår: </span>
              <span>{yearLabel}</span>
            </Link>

            <form
              role="search"
              action={`${basePath}/familier`}
              className="order-4 w-full lg:order-2 lg:mx-auto lg:max-w-[46rem]"
            >
              <label htmlFor="admin-global-search" className="sr-only">
                Søk etter elev eller foresatt
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-4 size-[1.125rem] -translate-y-1/2 text-[#3C8F44]"
                />
                <input
                  id="admin-global-search"
                  name="q"
                  type="search"
                  placeholder="Søk etter elev eller foresatt …"
                  autoComplete="off"
                  className="min-h-11 w-full rounded-xl border border-[#AFCFB3] bg-white pr-4 pl-11 text-base outline-none transition-shadow placeholder:text-admin-muted focus-visible:border-[#3C8F44] focus-visible:ring-3 focus-visible:ring-[#3C8F44]/18 lg:text-sm"
                />
              </div>
            </form>

            <Link
              href={`${basePath}/konto`}
              className="order-3 inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#E4E1D8] bg-white text-foreground outline-none transition-colors hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50 lg:order-3 lg:w-auto lg:gap-2 lg:px-3"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
                <UserRound aria-hidden="true" className="size-4" />
              </span>
              <span className="hidden text-sm font-bold xl:inline">
                Min konto
              </span>
              <span className="sr-only xl:hidden">Min konto</span>
            </Link>
          </div>
        </header>

        <div className="flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[96rem]">{children}</div>
        </div>
      </div>
    </div>
  );
}
