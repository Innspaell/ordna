import { PICK_CONTEXTS } from "./inbox";
import type { PickContext } from "./quick-add/parse";

/** Høyst tre fokusoppgaver per dag. Fullførte teller ikke. */
export const FOCUS_LIMIT = 3;

/** Kan oppgaven legges i fokus i dag, gitt de som allerede er der? */
export function focusDecision(currentFocusIds: string[], itemId: string): "ok" | "already" | "full" {
  if (currentFocusIds.includes(itemId)) return "already";
  if (currentFocusIds.length >= FOCUS_LIMIT) return "full";
  return "ok";
}

export function parseContextFilter(v: string | undefined): PickContext | null {
  return PICK_CONTEXTS.some((c) => c.value === v) ? (v as PickContext) : null;
}
