import { STATUS, type StatusKey } from "@/lib/ui";

/** Farget statusmerke. variant="cell" fyller hele cellen (tabell på PC). */
export function StatusPill({ status, className = "" }: { status: StatusKey; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap text-white ${className}`} style={{ background: s.bg }}>
      {s.label}
    </span>
  );
}

/** Liten farget prikk for prosjekt. */
export function Dot({ color, className = "" }: { color: string; className?: string }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`} style={{ background: color }} aria-hidden="true" />;
}
