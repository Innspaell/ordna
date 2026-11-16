"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "I dag" },
  { href: "/innboks", label: "Innboks" },
  { href: "/prosjekter", label: "Prosjekter" },
];

/** Navigasjon nederst. Plukk kommer i steg 11. */
export function BottomNav({ inboxCount }: { inboxCount: number }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch gap-1 px-4 pr-24">
        {LINKS.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex h-14 flex-1 items-center justify-center gap-1.5 text-sm font-medium ${active ? "text-brand" : "text-muted"}`}
            >
              {l.label}
              {l.href === "/innboks" && inboxCount > 0 && (
                <span className="rounded-full bg-brand px-1.5 text-xs font-semibold text-white tabular-nums">{inboxCount}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
