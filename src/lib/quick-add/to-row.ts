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
  assignee_profile_id: string | null;
};

export type ToRowResult =
  | { ok: true; row: ItemInsert; where: string }
  | { ok: false; reason: "empty_title" }
  | { ok: false; reason: "choose_project"; candidates: ProjectOption[] };

/** Gjør en tolket tekst om til en rad i items, klar for lagring. */
export function toItemRow(
  parsed: QuickAddResult,
  ctx: { defaultWorkspaceId: string; projects: ProjectOption[]; chosenProjectId?: string },
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
  const row: ItemInsert = {
    // Elementer i et prosjekt får arbeidsområdet fra prosjektet (trigger i databasen)
    workspace_id: parsed.workspace?.id ?? ctx.defaultWorkspaceId,
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
    assignee_profile_id: parsed.person?.id ?? null,
  };

  const base = target
    ? target.kind === "subproject" && target.projectName
      ? `${target.projectName} › ${target.name}`
      : target.name
    : row.is_pickable
      ? "Plukklisten"
      : row.in_inbox
        ? "Innboks"
        : (parsed.workspace?.name ?? "Jobb");
  const where = parsed.person ? `${base} · ${parsed.person.name}` : base;

  return { ok: true, row, where };
}
