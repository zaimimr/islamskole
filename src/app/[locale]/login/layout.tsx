import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Logg inn",
  robots: { index: false, follow: false },
};

export default function LoginLayout({
  children,
}: LayoutProps<"/[locale]/login">) {
  return (
    <div
      data-admin-login
      className="flex min-h-dvh flex-1 items-center justify-center bg-[#FCFAF5] p-4"
    >
      {children}
    </div>
  );
}
