import { osloToUtcIso, type PickContext, type ProjectOption, type QuickAddResult } from "./parse";

export type ItemInsert = {
  workspace_id: string;
  kind: "task" | "appointment";
  title: string;
  in_inbox: boolean;
  project_id: string | null;
  parent_id: string | null;
  due_date: string | null;
  is_pickable: boolean;
  pick_context: PickContext | null;
  starts_at: string | null;
  ends_at: string | null;
};

export type ToRowResult =
  | { ok: true; row: ItemInsert; people: string[]; where: string }
  | { ok: false; reason: "empty_title" }
  | { ok: false; reason: "choose_project"; candidates: ProjectOption[] };

/** Gjør en tolket tekst om til en rad i items, klar for lagring. */
export function toItemRow(
  parsed: QuickAddResult,
  ctx: { defaultWorkspaceId: string; familyWorkspaceId?: string | null; projects: ProjectOption[]; chosenProjectId?: string },
): ToRowResult {
  if (!parsed.title) return { ok: false, reason: "empty_title" };

  let target: ProjectOption | undefined;
  if (parsed.project.status === "one") target = parsed.project.match;
  if (parsed.project.status === "many") {
    const candidates = parsed.project.candidates;
    target = candidates.find((c) => c.id === ctx.chosenProjectId);
    if (!target) return { ok: false, reason: "choose_project", candidates };
  }

  const appointment = parsed.kind === "appointment";
  // @navn uten #område eller #prosjekt gjelder familien
  const family = !parsed.workspace && !target && parsed.people.length > 0 && ctx.familyWorkspaceId ? { id: ctx.familyWorkspaceId, name: "Familie" } : null;
  const workspace = parsed.workspace ?? family ?? undefined;
  const row: ItemInsert = {
    // Elementer i et prosjekt får arbeidsområdet fra prosjektet (trigger i databasen)
    workspace_id: workspace?.id ?? ctx.defaultWorkspaceId,
    kind: parsed.kind,
    title: parsed.title,
    in_inbox: parsed.inInbox && !target,
    project_id: target ? target.projectId : null,
    parent_id: target && target.kind === "subproject" ? target.id : null,
    due_date: appointment ? null : (parsed.dueDate ?? null),
    is_pickable: !appointment && !!parsed.pickContext,
    pick_context: appointment ? null : (parsed.pickContext ?? null),
    starts_at: appointment && parsed.startDate && parsed.startTime ? osloToUtcIso(parsed.startDate, parsed.startTime) : null,
    ends_at: appointment && parsed.startDate && parsed.endTime ? osloToUtcIso(parsed.startDate, parsed.endTime) : null,
  };

  const base = target
    ? target.kind === "subproject" && target.projectName
      ? `${target.projectName} › ${target.name}`
      : target.name
    : row.is_pickable
      ? "Plukklisten"
      : row.in_inbox
        ? "Innboks"
        : (workspace?.name ?? "Jobb");
  const names = parsed.people.map((p) => p.name);
  const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} og ${names[names.length - 1]}` : names[0];
  const where = who ? `${base} · ${who}` : base;

  return { ok: true, row, people: parsed.people.map((p) => p.id), where };
}
