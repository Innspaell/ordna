/** Fra én ting (mal) og en liste datoer til rader i items for en serie. */
import { osloParts } from "./item-edit";
import { osloToUtcIso } from "./quick-add/parse";

type Source = {
  workspace_id: string;
  project_id: string | null;
  parent_id: string | null;
  kind: "task" | "appointment";
  title: string;
  notes: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  due_date: string | null;
  pick_context: string | null;
  is_pickable: boolean;
  in_inbox?: boolean;
};

export type SeriesTemplate = Omit<Source, "starts_at" | "ends_at" | "due_date" | "in_inbox"> & { startTime: string | null; endTime: string | null; endOffsetDays: number };

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

export function templateOf(s: Source): SeriesTemplate {
  const start = s.starts_at ? osloParts(s.starts_at) : null;
  const end = s.ends_at ? osloParts(s.ends_at) : null;
  return {
    workspace_id: s.workspace_id, project_id: s.project_id, parent_id: s.parent_id, kind: s.kind, title: s.title, notes: s.notes, location: s.location,
    all_day: s.all_day, pick_context: s.pick_context, is_pickable: s.is_pickable,
    startTime: start ? (s.all_day ? "00:00" : start.time) : null,
    endTime: end ? end.time : null,
    endOffsetDays: start && end ? dayDiff(start.date, end.date) : 0,
  };
}

export function seriesRows(t: SeriesTemplate, dates: string[], seriesId: string) {
  return dates.map((d) => {
    const appt = t.kind === "appointment" && t.startTime;
    const endDate = new Date(`${d}T00:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() + t.endOffsetDays);
    return {
      workspace_id: t.workspace_id, project_id: t.project_id, parent_id: t.parent_id, kind: t.kind, title: t.title, notes: t.notes, location: t.location,
      all_day: t.all_day, pick_context: t.pick_context, is_pickable: t.is_pickable, in_inbox: false, status: "ready" as const,
      starts_at: appt ? osloToUtcIso(d, t.startTime!) : null,
      ends_at: appt && t.endTime && !t.all_day ? osloToUtcIso(endDate.toISOString().slice(0, 10), t.endTime) : null,
      due_date: t.kind === "task" ? d : null,
      series_id: seriesId,
      occurrence_date: d,
    };
  });
}
