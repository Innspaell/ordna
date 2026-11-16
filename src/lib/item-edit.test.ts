import { describe, expect, it } from "vitest";
import { appointmentPatch, moveSortOrder, osloParts, projectFields, taskPatch } from "./item-edit";

describe("taskPatch", () => {
  it("godtar gyldige felt og rydder tittel og notater", () => {
    expect(taskPatch({ title: "  Ring kunden ", status: "in_progress", due_date: "2026-11-20", notes: "  husk tilbud  " })).toEqual({
      ok: true,
      patch: { title: "Ring kunden", status: "in_progress", due_date: "2026-11-20", in_inbox: false, notes: "husk tilbud" },
    });
  });

  it("tom frist og tomme notater blir null", () => {
    expect(taskPatch({ due_date: "", notes: "  " })).toEqual({ ok: true, patch: { due_date: null, notes: null } });
  });

  it("tom tittel avvises", () => {
    expect(taskPatch({ title: "  " })).toMatchObject({ ok: false });
  });

  it("ukjent status og ugyldig dato avvises", () => {
    expect(taskPatch({ status: "waiting" as never })).toMatchObject({ ok: false });
    expect(taskPatch({ due_date: "2026-13-01" })).toMatchObject({ ok: false });
  });

  it("plukkliste: sted kreves når på, og fjernes når av", () => {
    expect(taskPatch({ is_pickable: true, pick_context: "phone" })).toEqual({ ok: true, patch: { is_pickable: true, pick_context: "phone", in_inbox: false } });
    expect(taskPatch({ is_pickable: true, pick_context: null })).toMatchObject({ ok: false });
    expect(taskPatch({ is_pickable: false })).toEqual({ ok: true, patch: { is_pickable: false, pick_context: null, focus_date: null } });
  });

  it("frist tar oppgaven ut av innboksen", () => {
    expect(taskPatch({ due_date: "2026-11-20" })).toMatchObject({ patch: { in_inbox: false } });
  });
});

describe("projectFields", () => {
  const options = [
    { id: "p1", projectId: "p1", kind: "project" as const, name: "Bryllupsvideo" },
    { id: "s1", projectId: "p1", kind: "subproject" as const, name: "Redigering" },
  ];
  it("prosjekt, delprosjekt og ingen", () => {
    expect(projectFields("p1", options)).toEqual({ ok: true, patch: { project_id: "p1", parent_id: null, in_inbox: false } });
    expect(projectFields("s1", options)).toEqual({ ok: true, patch: { project_id: "p1", parent_id: "s1", in_inbox: false } });
    expect(projectFields(null, options)).toEqual({ ok: true, patch: { project_id: null, parent_id: null } });
  });
  it("ukjent prosjekt avvises", () => {
    expect(projectFields("x", options)).toMatchObject({ ok: false });
  });
});

describe("appointmentPatch", () => {
  it("dato og tider blir UTC", () => {
    expect(appointmentPatch({ title: "Skrivekurs", date: "2026-11-21", start: "12:00", end: "20:00", all_day: false, location: " Samfundet ", notes: "" })).toEqual({
      ok: true,
      patch: {
        title: "Skrivekurs",
        starts_at: "2026-11-21T11:00:00.000Z",
        ends_at: "2026-11-21T19:00:00.000Z",
        all_day: false,
        location: "Samfundet",
        notes: null,
      },
    });
  });

  it("uten slutt: ingen sluttid", () => {
    expect(appointmentPatch({ title: "Møte", date: "2026-11-21", start: "09:00", end: "", all_day: false })).toMatchObject({
      ok: true,
      patch: { ends_at: null },
    });
  });

  it("slutt må være etter start", () => {
    expect(appointmentPatch({ title: "Møte", date: "2026-11-21", start: "12:00", end: "11:00", all_day: false })).toEqual({
      ok: false,
      message: "Slutt må være etter start.",
    });
    expect(appointmentPatch({ title: "Møte", date: "2026-11-21", start: "12:00", end: "12:00", all_day: false })).toMatchObject({ ok: false });
  });

  it("hele dagen: fra midnatt, uten klokkeslett", () => {
    expect(appointmentPatch({ title: "Fri", date: "2027-07-15", start: "", end: "", all_day: true })).toMatchObject({
      ok: true,
      patch: { starts_at: "2027-07-14T22:00:00.000Z", ends_at: null, all_day: true },
    });
  });

  it("dato og starttid kreves", () => {
    expect(appointmentPatch({ title: "X", date: "", start: "10:00", end: "", all_day: false })).toMatchObject({ ok: false });
    expect(appointmentPatch({ title: "X", date: "2026-11-21", start: "", end: "", all_day: false })).toMatchObject({ ok: false });
    expect(appointmentPatch({ title: "X", date: "2026-11-21", start: "25:00", end: "", all_day: false })).toMatchObject({ ok: false });
  });
});

describe("osloParts", () => {
  it("UTC-tidspunkt → dato og klokkeslett i Oslo", () => {
    expect(osloParts("2026-11-21T11:00:00.000Z")).toEqual({ date: "2026-11-21", time: "12:00" });
    expect(osloParts("2027-07-14T22:00:00.000Z")).toEqual({ date: "2027-07-15", time: "00:00" });
  });
});

describe("moveSortOrder", () => {
  it("bytter plass med naboen", () => {
    const list = [
      { id: "a", sort_order: 0 },
      { id: "b", sort_order: 1 },
      { id: "c", sort_order: 2 },
    ];
    expect(moveSortOrder(list, "b", -1)).toEqual([
      { id: "b", sort_order: 0 },
      { id: "a", sort_order: 1 },
    ]);
    expect(moveSortOrder(list, "b", 1)).toEqual([
      { id: "b", sort_order: 2 },
      { id: "c", sort_order: 1 },
    ]);
  });
  it("ingenting å flytte i endene", () => {
    const list = [
      { id: "a", sort_order: 0 },
      { id: "b", sort_order: 1 },
    ];
    expect(moveSortOrder(list, "a", -1)).toEqual([]);
    expect(moveSortOrder(list, "b", 1)).toEqual([]);
  });
  it("like sort_order får nye verdier", () => {
    const list = [
      { id: "a", sort_order: 0 },
      { id: "b", sort_order: 0 },
    ];
    expect(moveSortOrder(list, "b", -1)).toEqual([
      { id: "b", sort_order: 0 },
      { id: "a", sort_order: 1 },
    ]);
  });
});
