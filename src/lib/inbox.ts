import type { PickContext, ProjectOption } from "./quick-add/parse";

export const PICK_CONTEXTS: { value: PickContext; label: string }[] = [
  { value: "home", label: "Hjemme" },
  { value: "computer", label: "PC" },
  { value: "phone", label: "Telefon" },
  { value: "outside", label: "Ute" },
];

export type InboxAction =
  | { type: "project"; option: Pick<ProjectOption, "id" | "projectId" | "kind" | "name"> }
  | { type: "pick"; context: PickContext }
  | { type: "due"; date: string }
  | { type: "done" };

export type InboxPatch = Record<string, string | boolean | null>;

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Hva som endres på et element når det behandles i innboksen. Alle valg tar det ut av innboksen. */
export function inboxPatch(action: InboxAction): { ok: true; patch: InboxPatch } | { ok: false } {
  switch (action.type) {
    case "project":
      return {
        ok: true,
        patch: {
          project_id: action.option.projectId,
          parent_id: action.option.kind === "subproject" ? action.option.id : null,
          in_inbox: false,
        },
      };
    case "pick":
      if (!PICK_CONTEXTS.some((c) => c.value === action.context)) return { ok: false };
      return { ok: true, patch: { is_pickable: true, pick_context: action.context, in_inbox: false } };
    case "due":
      if (!isValidDate(action.date)) return { ok: false };
      return { ok: true, patch: { due_date: action.date, in_inbox: false } };
    case "done":
      return { ok: true, patch: { status: "done", in_inbox: false } };
  }
}
