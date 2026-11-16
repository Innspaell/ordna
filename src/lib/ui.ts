/**
 * Farger som betyr noe, brukt likt overalt.
 * Statusfarger er mørke nok til hvit tekst (minst 4,5:1).
 */

export type StatusKey = "ready" | "in_progress" | "waiting" | "done" | "overdue" | "cancelled";

export const STATUS: Record<StatusKey, { label: string; bg: string }> = {
  ready: { label: "Klar", bg: "#667085" },
  in_progress: { label: "Under arbeid", bg: "#b45309" },
  waiting: { label: "Venter", bg: "#1d5fbf" },
  done: { label: "Fullført", bg: "#1f7a4d" },
  overdue: { label: "Forfalt", bg: "#b42318" },
  cancelled: { label: "Avbrutt", bg: "#475467" },
};

/** Avtaler er alltid blå. */
export const APPOINTMENT_COLOR = "#1d5fbf";

/** Statusen som vises: forfalt vinner over klar, under arbeid og venter. */
export function taskStatusKey(status: string, dueDate: string | null, today: string): StatusKey {
  if (status === "done") return "done";
  if (status === "cancelled") return "cancelled";
  if (dueDate && dueDate < today) return "overdue";
  if (status === "in_progress" || status === "waiting") return status;
  return "ready";
}

/** Farger til prosjekter og delprosjekter (stripe, prikk, fremdrift). */
export const GROUP_COLORS = ["#3b6fd8", "#d9822b", "#7c5cd6", "#0e8a7e", "#c2417a", "#5f8d1f", "#2f86b3", "#a35d2a"];
export const NO_PROJECT_COLOR = "#98a2b3";

/** Fast farge per prosjekt, regnet ut fra id-en. Ingen lagring nødvendig. */
export function projectColor(id: string | null | undefined): string {
  if (!id) return NO_PROJECT_COLOR;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GROUP_COLORS[h % GROUP_COLORS.length];
}
