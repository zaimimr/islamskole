"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  CircleUserRound,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavCounts = {
  applications: number;
  teacherApplications: number;
};

const NavCountsContext = createContext<NavCounts>({
  applications: 0,
  teacherApplications: 0,
});

export function NavCountsProvider({
  counts,
  children,
}: {
  counts: NavCounts;
  children: React.ReactNode;
}) {
  return (
    <NavCountsContext.Provider value={counts}>
      {children}
    </NavCountsContext.Provider>
  );
}

type NavLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  alsoMatches?: string[];
  count?: number;
  countLabel?: string;
};

type NavGroup = {
  label: string;
  links: NavLink[];
};

function buildNavigation(basePath: string, counts: NavCounts) {
  const primary: NavLink[] = [
    { href: basePath, label: "Arbeidsflate", icon: LayoutDashboard },
    {
      href: `${basePath}/register`,
      label: "Opptak",
      icon: ClipboardCheck,
      count: counts.applications,
      countLabel: "nye innmeldinger",
    },
    {
      href: `${basePath}/familier`,
      label: "Familier",
      icon: Users,
      alsoMatches: [`${basePath}/elever`],
    },
    { href: `${basePath}/klasser`, label: "Klasser", icon: GraduationCap },
    { href: `${basePath}/betaling`, label: "Økonomi", icon: Wallet },
    { href: `${basePath}/skolear`, label: "Skoleår", icon: CalendarRange },
  ];

  const groups: NavGroup[] = [
    {
      label: "Nettside",
      links: [
        {
          href: `${basePath}/aktiviteter`,
          label: "Aktiviteter",
          icon: CalendarDays,
        },
        {
          href: `${basePath}/innstillinger`,
          label: "Innstillinger",
          icon: Settings,
        },
      ],
    },
    {
      label: "Administrasjon",
      links: [
        {
          href: `${basePath}/laerere`,
          label: "Lærere",
          icon: UserCheck,
          count: counts.teacherApplications,
          countLabel: "nye lærersøknader",
        },
        { href: `${basePath}/brukere`, label: "Brukere", icon: ShieldCheck },
        {
          href: `${basePath}/revisjon`,
          label: "Revisjonshistorikk",
          icon: ScrollText,
        },
      ],
    },
  ];

  const account: NavLink = {
    href: `${basePath}/konto`,
    label: "Min konto",
    icon: CircleUserRound,
  };

  return { primary, groups, account };
}

export function SidebarNav({
  basePath,
  onNavigate,
}: {
  basePath: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const counts = useContext(NavCountsContext);
  const navigation = buildNavigation(basePath, counts);

  function matchesPath(href: string) {
    if (href === basePath) return pathname === basePath;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function isActive(link: NavLink) {
    return (
      matchesPath(link.href) ||
      (link.alsoMatches ?? []).some((href) => matchesPath(href))
    );
  }

  function NavItem({
    link,
    compact = false,
  }: {
    link: NavLink;
    compact?: boolean;
  }) {
    const active = isActive(link);
    const Icon = link.icon;
    const count = link.count ?? 0;

    return (
      <Link
        href={link.href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
          compact ? "text-[0.8125rem]" : "text-sm",
          active
            ? "bg-[#DCEDDD] text-[#216A2B]"
            : "text-foreground/72 hover:bg-[#F2F1EB] hover:text-foreground",
        )}
      >
        <Icon
          aria-hidden={true}
          className={cn(
            "size-[1.125rem] shrink-0 stroke-[1.8]",
            active
              ? "text-[#3C8F44]"
              : "text-admin-muted group-hover:text-foreground/75",
          )}
        />
        <span className="min-w-0 flex-1">{link.label}</span>
        {count > 0 ? (
          <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-[#FEEDCA] px-1.5 py-0.5 text-xs font-bold text-[#6B4A06] tabular-nums">
            {count}
            <span className="sr-only"> {link.countLabel}</span>
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <nav
      aria-label="Administrasjon"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1"
    >
      <ul className="grid gap-1">
        {navigation.primary.map((link) => (
          <li key={link.href}>
            <NavItem link={link} />
          </li>
        ))}
      </ul>

      <div className="my-5 h-px bg-[#E9E5DC]" />

      <div className="grid gap-5">
        {navigation.groups.map((group) => (
          <section key={group.label} aria-labelledby={`nav-${group.label}`}>
            <h2
              id={`nav-${group.label}`}
              className="mb-1 px-3 font-sans text-[0.6875rem] font-bold tracking-[0.08em] text-admin-muted uppercase"
            >
              {group.label}
            </h2>
            <ul className="grid gap-0.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <NavItem link={link} compact />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-auto pt-5">
        <div className="mb-3 h-px bg-[#E9E5DC]" />
        <Link
          href={navigation.account.href}
          aria-current={isActive(navigation.account) ? "page" : undefined}
          onClick={onNavigate}
          className="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-foreground/72 outline-none transition-colors hover:bg-[#F2F1EB] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-[#DCEDDD] aria-[current=page]:text-[#216A2B]"
        >
          <CircleUserRound
            aria-hidden="true"
            className="size-[1.125rem] shrink-0 stroke-[1.8] text-admin-muted group-aria-[current=page]:text-[#3C8F44]"
          />
          {navigation.account.label}
        </Link>
      </div>
    </nav>
  );
}
