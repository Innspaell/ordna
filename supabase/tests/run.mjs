// Tester datamodellen mot en ekte Postgres (PGlite) uten Supabase.
// Kjør: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");

const db = new PGlite();
await db.exec(readFileSync(join(here, "supabase-stub.sql"), "utf8"));
for (const f of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
  try {
    await db.exec(readFileSync(join(migrations, f), "utf8"));
  } catch (e) {
    console.error(`Migrering ${f} feilet: ${e.message}`);
    process.exit(1);
  }
}

let passed = 0;
const failures = [];

/** Kjører SQL som databaseeier (forbi RLS). */
async function sql(text, params = []) {
  await db.exec("reset role");
  return (await db.query(text, params)).rows;
}
async function one(text, params = []) {
  const rows = await sql(text, params);
  if (rows.length !== 1) throw new Error(`forventet én rad, fikk ${rows.length}`);
  return rows[0];
}
/** Kjører SQL som innlogget bruker (rolle authenticated + auth.uid()). */
async function as(userId, text, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec("set role authenticated");
  try {
    return (await db.query(text, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}
async function asAnon(text, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.exec("set role anon");
  try {
    return (await db.query(text, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (e) {
    failures.push(name);
    console.log("  ✗ " + name + "\n      " + e.message);
  }
}
function eq(actual, expected, what = "") {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what} forventet ${b}, fikk ${a}`);
}
async function fails(promise, pattern) {
  try {
    await promise;
  } catch (e) {
    if (pattern && !pattern.test(e.message)) throw new Error(`feil melding: ${e.message}`);
    return;
  }
  throw new Error("skulle ha feilet, men gikk gjennom");
}

// ── Grunnoppsett ────────────────────────────────────────────────
const [user] = await sql("insert into auth.users (email) values ('erlend@test.no') returning id");
const org = (await one("insert into organizations (name) values ('Min husstand') returning id")).id;
const me = (await one("insert into profiles (auth_user_id, display_name) values ($1, 'Erlend') returning id", [user.id])).id;
const other = (await one("insert into profiles (display_name) values ('Annen') returning id")).id;
const privat = (await one("insert into workspaces (organization_id, name, kind, owner_profile_id) values ($1, 'Privat', 'private', $2) returning id", [org, me])).id;
const jobb = (await one("insert into workspaces (organization_id, name, kind) values ($1, 'Jobb', 'work') returning id", [org])).id;
await sql("insert into memberships (workspace_id, profile_id, role) values ($1, $2, 'owner'), ($3, $2, 'owner')", [privat, me, jobb]);

console.log("\nOrdna – datamodell\n");

await test("migrasjonene kjører rent fra tom database", async () => {
  const tables = (await sql("select tablename from pg_tables where schemaname = 'public' order by 1")).map((r) => r.tablename);
  eq(tables, ["checklist_items", "items", "memberships", "organizations", "profiles", "projects", "usage_events", "workspaces"]);
});

await test("RLS er slått på for alle tabeller", async () => {
  const off = await sql("select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity");
  eq(off, []);
});

await test("uten policyer ser verken anon eller innlogget bruker noe", async () => {
  eq((await asAnon("select * from items")).length, 0, "anon");
  eq((await as(user.id, "select * from projects")).length, 0, "innlogget");
});

await test("privat arbeidsområde må ha eier, og bare eieren kan være medlem", async () => {
  await fails(sql("insert into workspaces (organization_id, name, kind) values ($1, 'X', 'private')", [org]), /private_has_owner/);
  await fails(sql("insert into memberships (workspace_id, profile_id, role) values ($1, $2, 'member')", [privat, other]), /bare ha eieren/);
});

await test("tomme navn og titler avvises", async () => {
  await fails(sql("insert into projects (workspace_id, name) values ($1, '  ')", [jobb]), /check/);
  await fails(sql("insert into items (workspace_id, kind, title) values ($1, 'task', '')", [jobb]), /check/);
});

await test("delprosjekt må ha prosjekt", async () => {
  await fails(sql("insert into items (workspace_id, kind, title) values ($1, 'subproject', 'Løst')", [jobb]), /subproject_needs_project/);
});

await test("avtale må ha start, og slutt må være etter start", async () => {
  await fails(sql("insert into items (workspace_id, kind, title) values ($1, 'appointment', 'Møte')", [jobb]), /appointment_needs_start/);
  await fails(
    sql("insert into items (workspace_id, kind, title, starts_at, ends_at) values ($1, 'appointment', 'Møte', '2026-11-21 12:00+01', '2026-11-21 11:00+01')", [jobb]),
    /appointment_ends_after/,
  );
  await fails(sql("insert into items (workspace_id, kind, title, starts_at) values ($1, 'task', 'Oppgave', now())", [jobb]), /times_only_on_appointment/);
});

await test("oppgave i innboksen uten prosjekt beholder arbeidsområdet sitt", async () => {
  const r = await one("insert into items (workspace_id, kind, title, in_inbox) values ($1, 'task', 'Ring kunden', true) returning workspace_id, project_id", [jobb]);
  eq([r.workspace_id, r.project_id], [jobb, null]);
});

// ── Testprosjekt 1: UKErevyen 2027 ──────────────────────────────
const uke = (await one("insert into projects (workspace_id, name) values ($1, 'UKErevyen 2027') returning id", [jobb])).id;

await test("UKErevyen: to avtaler i prosjektet, arbeidsområdet settes fra prosjektet", async () => {
  await sql(
    `insert into items (workspace_id, project_id, kind, title, starts_at, ends_at) values
       ($1, $2, 'appointment', 'Skrivekurs', '2026-11-21 12:00 Europe/Oslo', '2026-11-21 20:00 Europe/Oslo'),
       ($1, $2, 'appointment', 'Redigering', '2026-11-22 10:00 Europe/Oslo', '2026-11-22 15:00 Europe/Oslo')`,
    [privat, uke], // bevisst feil arbeidsområde: skal overstyres av prosjektets
  );
  const rows = await sql("select title, workspace_id, to_char(starts_at at time zone 'Europe/Oslo', 'DD.MM HH24:MI') t from items where project_id = $1 order by starts_at", [uke]);
  eq(rows.map((r) => [r.title, r.workspace_id === jobb, r.t]), [
    ["Skrivekurs", true, "21.11 12:00"],
    ["Redigering", true, "22.11 10:00"],
  ]);
});

// ── Testprosjekt 2: Bryllupsvideo Ida og Sondre ─────────────────
const bv = (await one("insert into projects (workspace_id, name, due_date) values ($1, 'Bryllupsvideo Ida og Sondre', '2027-08-01') returning id", [jobb])).id;
const red = (await one("insert into items (workspace_id, project_id, kind, title) values ($1, $2, 'subproject', 'Redigering') returning id", [jobb, bv])).id;
const steps = ["Gjennomgang av opptak", "Grovklipp", "Finklipp", "Lyd og musikk", "Farge", "Godkjenning", "Levering"];
for (const [i, t] of steps.entries()) {
  await sql("insert into items (workspace_id, project_id, parent_id, kind, title, sort_order, due_date) values ($1, $2, $3, 'task', $4, $5, $6)", [
    jobb, bv, red, t, i, t === "Levering" ? "2027-08-01" : null,
  ]);
}

await test("Bryllupsvideo: sju oppgaver under delprosjektet Redigering", async () => {
  eq((await one("select count(*)::int n from items where parent_id = $1 and kind = 'task'", [red])).n, 7);
});

await test("fullført oppgave får completed_at, og mister det når den åpnes igjen", async () => {
  const done = await one("update items set status = 'done' where project_id = $1 and title = 'Grovklipp' returning completed_at", [bv]);
  if (!done.completed_at) throw new Error("mangler completed_at");
  const open = await one("update items set status = 'in_progress' where project_id = $1 and title = 'Grovklipp' returning completed_at", [bv]);
  eq(open.completed_at, null);
});

await test("endring i et element oppdaterer prosjektets siste aktivitet", async () => {
  await sql("update projects set last_activity_at = '2026-01-01' where id = $1", [bv]);
  await sql("update items set notes = 'test' where project_id = $1 and title = 'Farge'", [bv]);
  const p = await one("select last_activity_at > '2026-06-01' as fresh from projects where id = $1", [bv]);
  eq(p.fresh, true);
});

await test("forelder må være et delprosjekt i samme prosjekt", async () => {
  const task = (await one("select id from items where project_id = $1 and title = 'Farge'", [bv])).id;
  await fails(sql("insert into items (workspace_id, project_id, parent_id, kind, title) values ($1, $2, $3, 'task', 'Under oppgave')", [jobb, bv, task]), /under et delprosjekt/);
  await fails(sql("insert into items (workspace_id, project_id, parent_id, kind, title) values ($1, $2, $3, 'task', 'Feil prosjekt')", [jobb, uke, red]), /samme prosjekt/);
});

await test("delprosjekt kan ikke legges under seg selv eller sine egne barn", async () => {
  const sub = (await one("insert into items (workspace_id, project_id, parent_id, kind, title) values ($1, $2, $3, 'subproject', 'Lyd') returning id", [jobb, bv, red])).id;
  await fails(sql("update items set parent_id = $1 where id = $2", [sub, red]), /under seg selv/);
  await sql("delete from items where id = $1", [sub]);
});

await test("delprosjekt som flyttes til et annet prosjekt, tar med seg oppgavene", async () => {
  const p2 = (await one("insert into projects (workspace_id, name) values ($1, 'Midlertidig') returning id", [jobb])).id;
  const sub = (await one("insert into items (workspace_id, project_id, kind, title) values ($1, $2, 'subproject', 'Flyttes') returning id", [jobb, bv])).id;
  await sql("insert into items (workspace_id, project_id, parent_id, kind, title) values ($1, $2, $3, 'task', 'Følger med')", [jobb, bv, sub]);
  await sql("update items set project_id = $1 where id = $2", [p2, sub]);
  eq((await one("select project_id from items where title = 'Følger med'")).project_id, p2);
  await sql("delete from projects where id = $1", [p2]);
  eq((await sql("select * from items where title in ('Flyttes', 'Følger med')")).length, 0, "slettet med prosjektet");
});

await test("prosjekt som bytter arbeidsområde, tar med seg elementer og sjekklister", async () => {
  const p = (await one("insert into projects (workspace_id, name) values ($1, 'Flytteprosjekt') returning id", [jobb])).id;
  const t = (await one("insert into items (workspace_id, project_id, kind, title) values ($1, $2, 'task', 'Pakk') returning id", [jobb, p])).id;
  await sql("insert into checklist_items (workspace_id, item_id, text) values ($1, $2, 'Esker')", [jobb, t]);
  await sql("update projects set workspace_id = $1 where id = $2", [privat, p]);
  eq((await one("select workspace_id from items where id = $1", [t])).workspace_id, privat, "element");
  eq((await one("select workspace_id from checklist_items where item_id = $1", [t])).workspace_id, privat, "sjekkliste");
  await sql("delete from projects where id = $1", [p]);
});

await test("sjekkliste kan bare høre til en oppgave", async () => {
  const appt = (await one("select id from items where title = 'Skrivekurs'")).id;
  await fails(sql("insert into checklist_items (workspace_id, item_id, text) values ($1, $2, 'Ta med PC')", [jobb, appt]), /bare høre til en oppgave/);
  await fails(sql("insert into checklist_items (workspace_id, item_id, text) values ($1, $2, 'Punkt')", [jobb, red]), /bare høre til en oppgave/);
});

await test("plukkliste-felt og sted lagres", async () => {
  const r = await one("insert into items (workspace_id, kind, title, is_pickable, pick_context) values ($1, 'task', 'Skift lyspære', true, 'home') returning is_pickable, pick_context", [privat]);
  eq([r.is_pickable, r.pick_context], [true, "home"]);
});

console.log(`\n${passed} bestått, ${failures.length} feilet\n`);
process.exit(failures.length ? 1 : 0);
