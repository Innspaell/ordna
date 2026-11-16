const dateFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const dateYearFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit" });

/** Dato uten klokkeslett (YYYY-MM-DD) → «tor. 19. nov.», med år hvis det ikke er i år. */
export function formatDate(iso: string, today?: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (today && iso.slice(0, 4) !== today.slice(0, 4)) return dateYearFmt.format(d);
  return dateFmt.format(d);
}

/** Avtale → «lør. 21. nov. 12:00–20:00» */
export function formatAppointment(startsAt: string, endsAt: string | null): string {
  const s = new Date(startsAt);
  const time = endsAt ? `${timeFmt.format(s)}–${timeFmt.format(new Date(endsAt))}` : timeFmt.format(s);
  return `${dayFmt.format(s)} ${time}`;
}
