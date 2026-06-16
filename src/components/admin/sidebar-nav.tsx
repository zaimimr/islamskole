"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Users,
  UserPlus,
  UserCheck,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function SidebarNav({ basePath }: { basePath: string }) {
  const pathname = usePathname();

  const links: NavLink[] = [
    { href: basePath, label: "Oversikt", icon: LayoutDashboard },
    {
      href: `${basePath}/aktiviteter`,
      label: "Aktiviteter",
      icon: CalendarDays,
    },
    { href: `${basePath}/klasser`, label: "Klasser", icon: GraduationCap },
    { href: `${basePath}/register`, label: "Påmeldinger", icon: UserPlus },
    { href: `${basePath}/elever`, label: "Elever", icon: UserCheck },
    { href: `${basePath}/skolear`, label: "Skoleår", icon: CalendarRange },
    { href: `${basePath}/laerere`, label: "Lærere", icon: Users },
    {
      href: `${basePath}/innstillinger`,
      label: "Innstillinger",
      icon: Settings,
    },
    { href: `${basePath}/brukere`, label: "Brukere", icon: ShieldCheck },
    { href: `${basePath}/konto`, label: "Min konto", icon: UserCog },
  ];

  function isActive(href: string) {
    if (href === basePath) return pathname === basePath;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="flex flex-col gap-1">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive(href)
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
