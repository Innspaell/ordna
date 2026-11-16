import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Named, ProjectOption } from "./parse";

export type QuickAddContext = {
  projects: ProjectOption[];
  defaultWorkspaceId: string | null;
  /** Personer man deler arbeidsområde med (familien), for @navn */
  people: Named[];
  /** Arbeidsområdene, for #navn */
  workspaces: (Named & { kind: string })[];
};

/** Aktive prosjekter og delprosjekter brukeren kan se, og arbeidsområdet Jobb som standard. */
export async function loadQuickAddContext(supabase: SupabaseClient): Promise<QuickAddContext> {
  const [{ data: projects }, { data: subprojects }, { data: workspaces }, { data: profiles }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("status", "active").is("archived_at", null).order("name"),
    supabase.from("items").select("id, title, project_id").eq("kind", "subproject").order("title"),
    supabase.from("workspaces").select("id, kind, name").order("created_at"),
    supabase.from("profiles").select("id, display_name").order("display_name"),
  ]);

  const byId = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));
  const options: ProjectOption[] = [
    ...(projects ?? []).map((p) => ({ id: p.id as string, name: p.name as string, projectId: p.id as string, kind: "project" as const })),
    ...(subprojects ?? [])
      .filter((s) => byId.has(s.project_id as string))
      .map((s) => ({
        id: s.id as string,
        name: s.title as string,
        projectId: s.project_id as string,
        kind: "subproject" as const,
        projectName: byId.get(s.project_id as string),
      })),
  ];

  const ws = workspaces ?? [];
  // Standard: Jobb. Barn har bare Familie.
  const def = ws.find((w) => w.kind === "work") ?? ws.find((w) => w.kind === "family") ?? ws.find((w) => w.kind === "private");
  return {
    projects: options,
    defaultWorkspaceId: (def?.id as string) ?? null,
    people: (profiles ?? []).map((p) => ({ id: p.id as string, name: p.display_name as string })),
    workspaces: ws.map((w) => ({ id: w.id as string, name: w.name as string, kind: w.kind as string })),
  };
}
