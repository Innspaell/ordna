/**
 * Validering og omforming når oppgaver og avtaler redigeres. Rene funksjoner, testet i item-edit.test.ts.
 */
import { isValidDate, PICK_CONTEXTS } from "./inbox";
import { osloToUtcIso, type PickContext, type ProjectOption } from "./quick-add/parse";

export type Patch = Record<string, string | boolean | number | null>;
export type PatchResult = { ok: true; patch: Patch } | { ok: false; message: string };

export const TASK_STATUSES = [
  { value: "ready", label: "Klar" },
  { value: "in_progress", label: "Under arbeid" },
  { value: "done", label: "Fullført" },
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number]["value"];

export type TaskInput = {
  title?: string;
  status?: TaskStatus;
  due_date?: string | null;
  notes?: string | null;
  is_pickable?: boolean;
  pick_context?: PickContext | null;
};

const clean = (s: string | null | undefined) => {
  const t = (s ?? "").trim();
  return t ? t : null;
};

export function taskPatch(input: TaskInput): PatchResult {
  const patch: Patch = {};
  if (input.title !== undefined) {
    const t = clean(input.title);
    if (!t) return { ok: false, message: "Oppgaven må ha en tittel." };
    patch.title = t;
  }
  if (input.status !== undefined) {
    if (!TASK_STATUSES.some((s) => s.value === input.status)) return { ok: false, message: "Ukjent status." };
    patch.status = input.status;
  }
  if (input.due_date !== undefined) {
    const d = clean(input.due_date);
    if (d && !isValidDate(d)) return { ok: false, message: "Ugyldig dato." };
    patch.due_date = d;
    if (d) patch.in_inbox = false;
  }
  if (input.notes !== undefined) patch.notes = clean(input.notes);
  if (input.is_pickable !== undefined) {
    if (input.is_pickable) {
      if (!input.pick_context || !PICK_CONTEXTS.some((c) => c.value === input.pick_context)) return { ok: false, message: "Velg et sted." };
      patch.is_pickable = true;
      patch.pick_context = input.pick_context;
      patch.in_inbox = false;
    } else {
      patch.is_pickable = false;
      patch.pick_context = null;
      patch.focus_date = null;
    }
  }
  return { ok: true, patch };
}

/** Flytt til prosjekt eller delprosjekt (id fra listen), eller ut av prosjekt (null). */
export function projectFields(optionId: string | null, options: Pick<ProjectOption, "id" | "projectId" | "kind" | "name">[]): PatchResult {
  if (optionId === null) return { ok: true, patch: { project_id: null, parent_id: null } };
  const o = options.find((p) => p.id === optionId);
  if (!o) return { ok: false, message: "Fant ikke prosjektet." };
  return { ok: true, patch: { project_id: o.projectId, parent_id: o.kind === "subproject" ? o.id : null, in_inbox: false } };
}

export type AppointmentInput = {
  title: string;
  date: string;
  start: string;
  end: string;
  all_day: boolean;
  location?: string | null;
  notes?: string | null;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function appointmentPatch(input: AppointmentInput): PatchResult {
  const title = clean(input.title);
  if (!title) return { ok: false, message: "Avtalen må ha en tittel." };
  if (!isValidDate(input.date)) return { ok: false, message: "Velg en dato." };

  let starts_at: string;
  let ends_at: string | null = null;
  if (input.all_day) {
    starts_at = osloToUtcIso(input.date, "00:00");
  } else {
    if (!TIME.test(input.start)) return { ok: false, message: "Velg et starttidspunkt." };
    starts_at = osloToUtcIso(input.date, input.start);
    if (input.end) {
      if (!TIME.test(input.end)) return { ok: false, message: "Ugyldig sluttid." };
      if (input.end <= input.start) return { ok: false, message: "Slutt må være etter start." };
      ends_at = osloToUtcIso(input.date, input.end);
    }
  }

  const patch: Patch = { title, starts_at, ends_at, all_day: input.all_day };
  if (input.location !== undefined) patch.location = clean(input.location);
  if (input.notes !== undefined) patch.notes = clean(input.notes);
  return { ok: true, patch };
}

/** UTC-tidspunkt → dato (YYYY-MM-DD) og klokkeslett (HH:MM) i Oslo. */
export function osloParts(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Flytter ett element opp (-1) eller ned (+1). Returnerer radene som må få ny sort_order. */
export function moveSortOrder<T extends { id: string; sort_order: number }>(list: T[], id: string, dir: -1 | 1): { id: string; sort_order: number }[] {
  const ordered = [...list];
  const i = ordered.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ordered.length) return [];
  const neighbor = ordered[j];
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  const changes: { id: string; sort_order: number }[] = [];
  ordered.forEach((x, idx) => {
    if (x.id === id || x.id === neighbor.id || x.sort_order !== idx) changes.push({ id: x.id, sort_order: idx });
  });
  // Elementet som ble flyttet først
  return [...changes.filter((c) => c.id === id), ...changes.filter((c) => c.id !== id)];
}
