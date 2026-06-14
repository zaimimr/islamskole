import { redirect } from "next/navigation";
import Image from "next/image";
import { getIsAdmin } from "@/lib/auth";
import { SidebarNav } from "@/components/admin/sidebar-nav";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { adminBasePath, loginPath } from "@/components/admin/paths";

export default async function AdminLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;

  if (!(await getIsAdmin())) {
    redirect(loginPath(locale));
  }

  const basePath = adminBasePath(locale);

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <Image
            src="/brand/logo.png"
            alt="Islamskole Bærum"
            width={36}
            height={36}
            className="rounded-md"
          />
          <span className="font-heading text-base font-semibold">
            Adminpanel
          </span>
        </div>
        <SidebarNav basePath={basePath} />
        <div className="mt-auto pt-4">
          <SignOutButton loginHref={loginPath(locale)} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <Image
              src="/brand/logo.png"
              alt="Islamskole Bærum"
              width={32}
              height={32}
              className="rounded-md"
            />
            <span className="font-heading text-sm font-semibold">
              Adminpanel
            </span>
          </div>
          <SignOutButton loginHref={loginPath(locale)} />
        </header>
        <div className="md:hidden">
          <div className="border-b border-border bg-card px-4 py-2">
            <SidebarNav basePath={basePath} />
          </div>
        </div>

        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
