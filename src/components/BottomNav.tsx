"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icons";

type NavItem = { href: string; label: string; icon: IconName; mobile: boolean };

export const NAV: NavItem[] = [
  { href: "/", label: "I dag", icon: "today", mobile: true },
  { href: "/kalender", label: "Kalender", icon: "week", mobile: true },
  { href: "/innboks", label: "Innboks", icon: "inbox", mobile: true },
  { href: "/plukk", label: "Plukk", icon: "pick", mobile: true },
  { href: "/prosjekter", label: "Prosjekter", icon: "projects", mobile: true },
  { href: "/handleliste", label: "Handleliste", icon: "cart", mobile: false },
  { href: "/familie", label: "Familie", icon: "family", mobile: false },
];

/** Barn får en enklere meny. */
export const CHILD_NAV: NavItem[] = [
  { href: "/", label: "I dag", icon: "today", mobile: true },
  { href: "/kalender", label: "Kalender", icon: "week", mobile: true },
  { href: "/handleliste", label: "Handleliste", icon: "cart", mobile: true },
  { href: "/familie", label: "Familie", icon: "family", mobile: true },
];

export const isActive = (href: string, path: string) => (href === "/" ? path === "/" : path.startsWith(href));

/** Meny nederst på mobil. */
export function BottomNav({ inboxCount, child = false }: { inboxCount: number; child?: boolean }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-stretch px-1 pr-[72px]">
        {(child ? CHILD_NAV : NAV).filter((n) => n.mobile).map((l) => {
          const active = isActive(l.href, path);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`relative flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold ${active ? "text-brand" : "text-muted"}`}
            >
              <Icon name={l.icon} />
              {l.label}
              {l.href === "/innboks" && inboxCount > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-2 rounded-full bg-brand px-1.5 text-[10px] font-bold text-white tabular-nums">{inboxCount}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Sidemeny på PC. */
export function SideNav({ inboxCount, child = false }: { inboxCount: number; child?: boolean }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line bg-white px-3.5 py-6 md:flex">
      <Link href="/" className="px-2.5 pb-5 text-sm font-extrabold tracking-[0.1em] text-brand">
        ORDNA
      </Link>
      {(child ? CHILD_NAV : NAV).map((l) => {
        const active = isActive(l.href, path);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-semibold ${active ? "bg-brand-soft text-brand" : "text-muted hover:bg-paper"}`}
          >
            <Icon name={l.icon} size={20} />
            <span className="flex-1">{l.label}</span>
            {l.href === "/innboks" && inboxCount > 0 && <span className="rounded-full bg-brand px-2 text-xs font-bold text-white tabular-nums">{inboxCount}</span>}
          </Link>
        );
      })}
      <Link href="/ny" className="mt-4 flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2.5 text-sm font-semibold text-white hover:brightness-110">
        <Icon name="plus" size={18} /> Ny oppgave
      </Link>
      <div className="mt-auto flex flex-col gap-1 px-2.5 text-xs text-muted">
        {!child && <Link href="/bruk" className="hover:text-brand">Bruk</Link>}
        <Link href="/snarvei" className="hover:text-brand">Ordna på iPhone</Link>
        <form action="/auth/logout" method="post">
          <button className="hover:text-ink">Logg ut</button>
        </form>
      </div>
    </aside>
  );
}
