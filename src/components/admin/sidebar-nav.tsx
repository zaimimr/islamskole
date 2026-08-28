"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  CircleUserRound,
  CircleAlert,
  ClipboardCheck,
  ContactRound,
  GraduationCap,
  LayoutDashboard,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

type NavGroup = {
  label: string;
  links: NavLink[];
};

function buildNavigation(basePath: string) {
  const primary: NavLink[] = [
    { href: basePath, label: "Arbeidsflate", icon: LayoutDashboard },
    { href: `${basePath}/register`, label: "Opptak", icon: ClipboardCheck },
    {
      href: `${basePath}/elever`,
      label: "Familier og elever",
      icon: Users,
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
          label: "Kontaktopplysninger",
          icon: ContactRound,
        },
      ],
    },
    {
      label: "Økonomiverktøy",
      links: [
        {
          href: `${basePath}/betaling/logg`,
          label: "Betalingslogg",
          icon: ReceiptText,
        },
        {
          href: `${basePath}/betaling/dobbeltforinger`,
          label: "Dobbeltføringer",
          icon: CircleAlert,
        },
      ],
    },
    {
      label: "Administrasjon",
      links: [
        {
          href: `${basePath}/laerere`,
          label: "Lærersøknader",
          icon: UserCheck,
        },
        { href: `${basePath}/brukere`, label: "Brukere", icon: ShieldCheck },
        { href: `${basePath}/revisjon`, label: "Revisjon", icon: ScrollText },
      ],
    },
  ];

  const account: NavLink = {
    href: `${basePath}/konto`,
    label: "Min konto",
    icon: Settings,
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
  const navigation = buildNavigation(basePath);
  const allLinks = [
    ...navigation.primary,
    ...navigation.groups.flatMap((group) => group.links),
    navigation.account,
  ];

  function matches(href: string) {
    if (href === basePath) return pathname === basePath;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function isActive(href: string) {
    if (!matches(href)) return false;
    return !allLinks.some(
      (link) =>
        link.href !== href && link.href.startsWith(href) && matches(link.href),
    );
  }

  function NavItem({
    link,
    compact = false,
  }: {
    link: NavLink;
    compact?: boolean;
  }) {
    const active = isActive(link.href);
    const Icon = link.icon;

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
        <span>{link.label}</span>
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
          aria-current={isActive(navigation.account.href) ? "page" : undefined}
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
