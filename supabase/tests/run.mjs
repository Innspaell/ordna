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

/** Antall rader anon ser. Ingen tilgang i det hele tatt teller som 0. */
async function anonCount(table) {
  try {
    return (await asAnon(`select * from ${table}`)).length;
  } catch (e) {
    if (/permission denied/.test(e.message)) return 0;
    throw e;
  }
}

/** Kjører SQL som serveren med service role (forbi RLS, men med rollens rettigheter). */
async function asService(text, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.exec("set role service_role");
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
  eq(tables, ["checklist_items", "child_login_codes", "item_people", "items", "list_events", "memberships", "organizations", "profiles", "projects", "usage_events", "workspaces"]);
});

await test("RLS er slått på for alle tabeller", async () => {
  const off = await sql("select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity");
  eq(off, []);
});

await test("anon ser ingen elementer", async () => {
  eq(await anonCount("items"), 0, "anon");
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

// ── Tilgangsregler (steg 3) ─────────────────────────────────────
console.log("\nOrdna – tilgangsregler\n");

async function newUser(name) {
  const [u] = await sql("insert into auth.users (email) values ($1) returning id", [`${name}@test.no`]);
  const p = (await one("insert into profiles (auth_user_id, display_name) values ($1, $2) returning id", [u.id, name])).id;
  return { uid: u.id, pid: p };
}
const A = { uid: user.id, pid: me }; // Erlend: owner i Privat og Jobb
const B = await newUser("bruker-b");
const V = await newUser("viewer");
const M = await newUser("medlem");
const AD = await newUser("admin");
const orgB = (await one("insert into organizations (name) values ('B sin') returning id")).id;
const privatB = (await one("insert into workspaces (organization_id, name, kind, owner_profile_id) values ($1, 'Privat', 'private', $2) returning id", [orgB, B.pid])).id;
await sql("insert into memberships (workspace_id, profile_id, role) values ($1, $2, 'owner')", [privatB, B.pid]);
await sql("insert into memberships (workspace_id, profile_id, role) values ($1, $2, 'viewer'), ($1, $3, 'member'), ($1, $4, 'admin')", [jobb, V.pid, M.pid, AD.pid]);
const hemmelig = (await one("insert into items (workspace_id, kind, title) values ($1, 'task', 'Hemmelig') returning id", [privatB])).id;
const hemmeligSjekk = (await one("insert into checklist_items (workspace_id, item_id, text) values ($1, $2, 'Hemmelig punkt') returning id", [privatB, hemmelig])).id;
const projB = (await one("insert into projects (workspace_id, name) values ($1, 'B sitt prosjekt') returning id", [privatB])).id;

await test("anon ser ingenting i noen tabell", async () => {
  for (const t of ["organizations", "profiles", "workspaces", "memberships", "projects", "items", "checklist_items", "usage_events"]) {
    eq(await anonCount(t), 0, t);
  }
  await fails(asAnon("insert into items (workspace_id, kind, title) values ($1, 'task', 'x')", [jobb]), /row-level security|permission denied/);
});

await test("bruker A ser ingenting i bruker Bs private område", async () => {
  eq((await as(A.uid, "select * from workspaces where id = $1", [privatB])).length, 0, "arbeidsområde");
  eq((await as(A.uid, "select * from items where id = $1", [hemmelig])).length, 0, "element");
  eq((await as(A.uid, "select * from projects where id = $1", [projB])).length, 0, "prosjekt");
  eq((await as(A.uid, "select * from memberships where workspace_id = $1", [privatB])).length, 0, "medlemskap");
  eq((await as(A.uid, "update items set title = 'Hacket' where id = $1 returning id", [hemmelig])).length, 0, "oppdatering");
  eq((await as(A.uid, "delete from items where id = $1 returning id", [hemmelig])).length, 0, "sletting");
  await fails(as(A.uid, "insert into items (workspace_id, kind, title) values ($1, 'task', 'Inn i B')", [privatB]), /row-level security/);
});

await test("bruker B ser sitt eget, men ikke As", async () => {
  eq((await as(B.uid, "select title from items where workspace_id = $1", [privatB])).map((r) => r.title), ["Hemmelig"]);
  eq((await as(B.uid, "select * from items where workspace_id = $1", [jobb])).length, 0);
});

await test("eier ser og endrer i egne arbeidsområder", async () => {
  const n = (await as(A.uid, "select count(*)::int n from items where workspace_id = $1", [jobb]))[0].n;
  if (n < 9) throw new Error(`forventet minst 9 elementer i Jobb, fikk ${n}`);
  const r = await as(A.uid, "insert into items (workspace_id, project_id, kind, title) values ($1, $2, 'task', 'Ny som eier') returning id", [jobb, bv]);
  eq(r.length, 1);
});

await test("viewer kan lese, men ikke endre", async () => {
  eq((await as(V.uid, "select name from projects where id = $1", [bv])).map((r) => r.name), ["Bryllupsvideo Ida og Sondre"], "lese");
  await fails(as(V.uid, "insert into items (workspace_id, kind, title) values ($1, 'task', 'Fra viewer')", [jobb]), /row-level security/);
  eq((await as(V.uid, "update projects set name = 'Endret' where id = $1 returning id", [bv])).length, 0, "oppdatere");
  eq((await as(V.uid, "delete from items where project_id = $1 returning id", [bv])).length, 0, "slette");
});

await test("medlem kan opprette og endre, men bare slette egne rader", async () => {
  const mine = (await as(M.uid, "insert into items (workspace_id, project_id, kind, title) values ($1, $2, 'task', 'Medlemmets') returning id, created_by_profile_id", [jobb, bv]))[0];
  eq(mine.created_by_profile_id, M.pid, "created_by settes automatisk");
  eq((await as(M.uid, "update items set notes = 'endret av medlem' where project_id = $1 and title = 'Farge' returning id", [bv])).length, 1, "endre andres");
  eq((await as(M.uid, "delete from items where project_id = $1 and title = 'Farge' returning id", [bv])).length, 0, "slette andres");
  eq((await as(M.uid, "delete from items where id = $1 returning id", [mine.id])).length, 1, "slette egen");
});

await test("created_by kan ikke forfalskes", async () => {
  await fails(as(M.uid, "insert into items (workspace_id, kind, title, created_by_profile_id) values ($1, 'task', 'Falsk', $2)", [jobb, A.pid]), /row-level security/);
});

await test("et element kan ikke flyttes til et prosjekt brukeren ikke har tilgang til", async () => {
  const t = (await as(A.uid, "insert into items (workspace_id, kind, title) values ($1, 'task', 'Skal ikke flyttes') returning id", [jobb]))[0].id;
  await fails(as(A.uid, "update items set project_id = $1 where id = $2", [projB, t]), /row-level security|null value|workspace_id/);
  await fails(as(A.uid, "update items set workspace_id = $1 where id = $2", [privatB, t]), /row-level security/);
  eq((await one("select workspace_id from items where id = $1", [t])).workspace_id, jobb, "ligger fortsatt i Jobb");
});

await test("en sjekkliste kan ikke leses uten tilgang til oppgaven", async () => {
  eq((await as(A.uid, "select * from checklist_items where id = $1", [hemmeligSjekk])).length, 0);
  await fails(as(A.uid, "insert into checklist_items (workspace_id, item_id, text) values ($1, $2, 'Inn')", [jobb, hemmelig]), /row-level security|bare høre til en oppgave/);
  eq((await as(B.uid, "select text from checklist_items where id = $1", [hemmeligSjekk])).map((r) => r.text), ["Hemmelig punkt"]);
});

await test("medlemskap: admin kan legge til medlemmer, men ikke røre eieren", async () => {
  const X = await newUser("ny");
  eq((await as(AD.uid, "insert into memberships (workspace_id, profile_id, role) values ($1, $2, 'member') returning role", [jobb, X.pid])).length, 1, "legge til");
  await fails(as(AD.uid, "insert into memberships (workspace_id, profile_id, role) values ($1, $2, 'owner')", [jobb, B.pid]), /row-level security/);
  eq((await as(AD.uid, "delete from memberships where workspace_id = $1 and profile_id = $2 returning 1", [jobb, A.pid])).length, 0, "fjerne eier");
  eq((await as(AD.uid, "update memberships set role = 'viewer' where workspace_id = $1 and profile_id = $2 returning 1", [jobb, A.pid])).length, 0, "nedgradere eier");
  await fails(as(M.uid, "insert into memberships (workspace_id, profile_id, role) values ($1, $2, 'member')", [jobb, B.pid]), /row-level security/);
  eq((await as(A.uid, "delete from memberships where workspace_id = $1 and profile_id = $2 returning 1", [jobb, X.pid])).length, 1, "eier fjerner");
});

await test("ingen kan legges til i et privat område", async () => {
  await fails(as(A.uid, "insert into memberships (workspace_id, profile_id, role) values ($1, $2, 'member')", [privat, B.pid]), /row-level security|bare ha eieren/);
});

await test("profiler: egen og de man deler arbeidsområde med", async () => {
  const names = (await as(V.uid, "select display_name from profiles order by display_name")).map((r) => r.display_name);
  eq(names.includes("Erlend") && names.includes("medlem") && !names.includes("bruker-b"), true, `fikk ${names}`);
  eq((await as(B.uid, "select display_name from profiles")).map((r) => r.display_name), ["bruker-b"]);
  eq((await as(B.uid, "update profiles set display_name = 'B2' where id = $1 returning 1", [B.pid])).length, 1, "endre egen");
  eq((await as(B.uid, "update profiles set display_name = 'X' where id = $1 returning 1", [A.pid])).length, 0, "endre andres");
});

await test("brukslogg: bare egne hendelser", async () => {
  eq((await as(A.uid, "insert into usage_events (profile_id, event, duration_ms) values ($1, 'quick_add', 3200) returning 1", [A.pid])).length, 1);
  await fails(as(A.uid, "insert into usage_events (profile_id, event) values ($1, 'quick_add')", [B.pid]), /row-level security/);
  eq((await as(B.uid, "select * from usage_events")).length, 0);
});

await test("innlogget bruker ser organisasjonen sin", async () => {
  eq((await as(A.uid, "select name from organizations")).map((r) => r.name), ["Min husstand"]);
  eq((await as(B.uid, "select name from organizations")).map((r) => r.name), ["B sin"]);
});

await test("prosjekt kan ikke flyttes til andres arbeidsområde", async () => {
  await fails(as(A.uid, "update projects set workspace_id = $1 where id = $2", [privatB, uke]), /row-level security/);
});

// ── Første innlogging (steg 4) ──────────────────────────────────
console.log("\nOrdna – første innlogging\n");

const [ny] = await sql("insert into auth.users (email, raw_user_meta_data) values ('ny.bruker@test.no', '{}') returning id");

await test("første innlogging oppretter profil, organisasjon, Privat og Jobb", async () => {
  const pid = (await as(ny.id, "select ensure_my_setup() as id"))[0].id;
  const p = await one("select display_name, auth_user_id from profiles where id = $1", [pid]);
  eq([p.display_name, p.auth_user_id], ["ny.bruker", ny.id]);
  const ws = await as(ny.id, "select w.name, w.kind, m.role from workspaces w join memberships m on m.workspace_id = w.id order by w.kind");
  eq(ws.map((w) => [w.name, w.kind, w.role]), [["Privat", "private", "owner"], ["Jobb", "work", "owner"]]);
  eq((await as(ny.id, "select owner_profile_id from workspaces where kind = 'private'"))[0].owner_profile_id, pid, "eier av Privat");
  eq((await as(ny.id, "select count(*)::int n from organizations"))[0].n, 1, "én organisasjon");
});

await test("andre innlogging oppretter ingenting nytt", async () => {
  const first = (await as(ny.id, "select ensure_my_setup() as id"))[0].id;
  const second = (await as(ny.id, "select ensure_my_setup() as id"))[0].id;
  eq(first, second, "samme profil");
  eq((await one("select count(*)::int n from profiles where auth_user_id = $1", [ny.id])).n, 1, "én profil");
  eq((await as(ny.id, "select count(*)::int n from workspaces"))[0].n, 2, "to arbeidsområder");
});

await test("eksisterende bruker beholder oppsettet sitt", async () => {
  eq((await as(A.uid, "select ensure_my_setup() as id"))[0].id, A.pid);
  eq((await one("select count(*)::int n from profiles where auth_user_id = $1", [A.uid])).n, 1);
});

await test("navn fra brukerdata brukes hvis det finnes", async () => {
  const [u] = await sql("insert into auth.users (email, raw_user_meta_data) values ('x@test.no', '{\"name\": \"Marte\"}') returning id");
  await as(u.id, "select ensure_my_setup()");
  eq((await one("select display_name from profiles where auth_user_id = $1", [u.id])).display_name, "Marte");
});

await test("den nye brukeren kan registrere en oppgave i Jobb med en gang", async () => {
  const jobbNy = (await as(ny.id, "select id from workspaces where kind = 'work'"))[0].id;
  eq((await as(ny.id, "insert into items (workspace_id, kind, title, in_inbox) values ($1, 'task', 'Første oppgave', true) returning title", [jobbNy])).map((r) => r.title), ["Første oppgave"]);
});

await test("uinnlogget kan ikke kjøre oppsettet", async () => {
  await fails(asAnon("select ensure_my_setup()"), /permission denied|ikke logget inn/);
});


// ── Familie ─────────────────────────────────────────────────────
console.log("\nOrdna – familie\n");

const famOwner = await newUser("forelder");
await as(famOwner.uid, "select ensure_my_setup()"); // finnes allerede, men har ikke Privat: får ikke nytt (laget direkte)
let fam;

await test("create_family_workspace lager Familie med eier og handleliste", async () => {
  // Gi forelderen et eget privat område først, som en vanlig bruker har
  const [u] = await sql("insert into auth.users (email) values ('foreldre2@test.no') returning id");
  await as(u.id, "select ensure_my_setup()");
  fam = (await as(u.id, "select create_family_workspace() as id"))[0].id;
  famOwner.uid = u.id;
  famOwner.pid = (await one("select id from profiles where auth_user_id = $1", [u.id])).id;
  const ws = await one("select kind, name, organization_id from workspaces where id = $1", [fam]);
  eq([ws.kind, ws.name], ["family", "Familie"]);
  const priv = await one("select organization_id from workspaces where owner_profile_id = $1", [famOwner.pid]);
  eq(ws.organization_id, priv.organization_id, "samme organisasjon som Privat");
  eq((await one("select role from memberships where workspace_id = $1 and profile_id = $2", [fam, famOwner.pid])).role, "owner");
  const list = await sql("select name, kind from projects where workspace_id = $1", [fam]);
  eq(list.map((l) => [l.name, l.kind]), [["Handleliste", "list"]]);
});

await test("andre kall gir samme familie", async () => {
  eq((await as(famOwner.uid, "select create_family_workspace() as id"))[0].id, fam);
});

await test("vanlige prosjekter har kind = project", async () => {
  eq((await one("select kind from projects where id = $1", [bv])).kind, "project");
});

let child;
await test("serveren legger til et barn: profil styrt av forelderen, medlem i familien", async () => {
  const [u] = await sql("insert into auth.users (email) values ('barn.123@barn.ordna.local') returning id");
  const pid = (await asService("select admin_add_family_member($1, $2, 'Ida', $3) as id", [fam, u.id, famOwner.pid]))[0].id;
  child = { uid: u.id, pid };
  const p = await one("select display_name, managed_by_profile_id from profiles where id = $1", [pid]);
  eq([p.display_name, p.managed_by_profile_id], ["Ida", famOwner.pid]);
  eq((await one("select role from memberships where workspace_id = $1 and profile_id = $2", [fam, pid])).role, "member");
});

await test("barnets første innlogging lager ikke Privat eller Jobb", async () => {
  eq((await as(child.uid, "select ensure_my_setup() as id"))[0].id, child.pid);
  eq((await as(child.uid, "select kind from workspaces order by kind")).map((w) => w.kind), ["family"]);
});

await test("barnet ser familien og handlelisten, men ikke forelderens Jobb eller Privat", async () => {
  const projects = (await as(child.uid, "select name from projects")).map((p) => p.name);
  eq(projects, ["Handleliste"]);
  const list = (await as(child.uid, "select id from projects where kind = 'list'"))[0].id;
  eq((await as(child.uid, "insert into items (workspace_id, project_id, kind, title) values ($1, $2, 'task', 'Melk') returning title", [fam, list])).map((r) => r.title), ["Melk"]);
  eq((await as(famOwner.uid, "select title from items where project_id = $1", [list])).map((r) => r.title), ["Melk"]);
});

await test("en voksen lagt til i familien får Privat og Jobb ved første innlogging", async () => {
  const [u] = await sql("insert into auth.users (email) values ('marthe@test.no') returning id");
  const pid = (await asService("select admin_add_family_member($1, $2, 'Marthe', null) as id", [fam, u.id]))[0].id;

  eq((await one("select role from memberships where workspace_id = $1 and profile_id = $2", [fam, pid])).role, "admin");
  await as(u.id, "select ensure_my_setup()");
  eq((await as(u.id, "select kind from workspaces order by kind")).map((w) => w.kind), ["private", "work", "family"]);
  const orgs = await as(u.id, "select distinct organization_id from workspaces");
  eq(orgs.length, 1, "alt i samme organisasjon");
});

await test("familiemedlemmer ser hverandres navn", async () => {
  const names = (await as(child.uid, "select display_name from profiles order by display_name")).map((p) => p.display_name);
  eq(names.includes("Marthe") && names.includes("Ida"), true, `fikk ${names}`);
});

await test("innloggede kan ikke kalle admin_add_family_member eller lese barnekoder", async () => {
  const [u] = await sql("insert into auth.users (email) values ('inntrenger@test.no') returning id");
  await fails(as(famOwner.uid, "select admin_add_family_member($1, $2, 'X', null)", [fam, u.id]), /permission denied/);
  await sql("insert into child_login_codes (profile_id, code_hash, expires_at) values ($1, 'hash1', now() + interval '1 day')", [child.pid]);
  await fails(as(famOwner.uid, "select * from child_login_codes"), /permission denied/);
  await fails(asAnon("select * from child_login_codes"), /permission denied/);
  eq((await asService("select count(*)::int n from child_login_codes"))[0].n, 1, "service role kan lese");
});

await test("admin_add_family_member avviser ikke-familieområder", async () => {
  const [u] = await sql("insert into auth.users (email) values ('feil@test.no') returning id");
  await fails(asService("select admin_add_family_member($1, $2, 'X', null)", [jobb, u.id]), /Ikke et familieområde/);
});

// ── Personfarge ─────────────────────────────────────────────────
await test("hver kan velge sin egen farge fra paletten", async () => {
  eq((await as(child.uid, "update profiles set color = '#a21caf' where id = $1 returning color", [child.pid]))[0].color, "#a21caf");
  eq((await as(famOwner.uid, "select color from profiles where id = $1", [child.pid]))[0].color, "#a21caf", "forelderen ser fargen");
});

await test("farge utenfor paletten avvises", async () => {
  await fails(as(child.uid, "update profiles set color = '#ff0000' where id = $1", [child.pid]), /check constraint|profiles_color/);
});

await test("ingen kan endre andres farge", async () => {
  eq((await as(famOwner.uid, "update profiles set color = '#0e7490' where id = $1 returning 1", [child.pid])).length, 0);
});

await test("barnet kan ikke endre hvem som styrer profilen", async () => {
  await fails(as(child.uid, "update profiles set managed_by_profile_id = null where id = $1", [child.pid]), /permission denied/);
  await fails(as(child.uid, "update profiles set auth_user_id = null where id = $1", [child.pid]), /permission denied/);
  eq((await one("select managed_by_profile_id from profiles where id = $1", [child.pid])).managed_by_profile_id, famOwner.pid);
});

// ── Flere personer på én ting ───────────────────────────────────
const marthe = await one("select p.id as pid, p.auth_user_id as uid from profiles p where display_name = 'Marthe'");
let kamp;

await test("en avtale kan gjelde flere personer i familien", async () => {
  kamp = (await as(famOwner.uid, "insert into items (workspace_id, kind, title, starts_at) values ($1, 'appointment', 'Kamp', now()) returning id", [fam]))[0].id;
  await as(famOwner.uid, "insert into item_people (item_id, profile_id) values ($1, $2), ($1, $3)", [kamp, famOwner.pid, child.pid]);
  const rows = await as(child.uid, "select profile_id, workspace_id from item_people where item_id = $1 order by profile_id", [kamp]);
  eq(rows.length, 2, "barnet ser begge");
  eq(rows.every((r) => r.workspace_id === fam), true, "arbeidsområdet settes fra elementet");
});

await test("samme person kan ikke legges på to ganger", async () => {
  await fails(as(famOwner.uid, "insert into item_people (item_id, profile_id) values ($1, $2)", [kamp, child.pid]), /duplicate|unique|item_people_pkey/);
});

await test("bare personer i arbeidsområdet kan legges på", async () => {
  await fails(as(famOwner.uid, "insert into item_people (item_id, profile_id) values ($1, $2)", [kamp, B.pid]), /ikke med i arbeidsområdet/);
});

await test("workspace_id kan ikke forfalskes", async () => {
  const privat = (await one("select id from workspaces where owner_profile_id = $1 and kind = 'private'", [famOwner.pid])).id;
  await as(marthe.uid, "insert into item_people (item_id, profile_id, workspace_id) values ($1, $2, $3)", [kamp, marthe.pid, privat]);
  eq((await one("select workspace_id from item_people where item_id = $1 and profile_id = $2", [kamp, marthe.pid])).workspace_id, fam);
  await as(marthe.uid, "delete from item_people where item_id = $1 and profile_id = $2", [kamp, marthe.pid]);
});

await test("uten tilgang til elementet: ingen personer og ingen innsetting", async () => {
  eq((await as(B.uid, "select * from item_people where item_id = $1", [kamp])).length, 0);
  await fails(as(B.uid, "insert into item_people (item_id, profile_id) values ($1, $2)", [kamp, child.pid]), /row-level security/);
  await fails(as(famOwner.uid, "insert into item_people (item_id, profile_id) values ($1, $2)", [hemmelig, famOwner.pid]), /row-level security|ikke med|Ukjent/);
  await fails(asAnon("select * from item_people"), /permission denied/);
});

await test("medlem (barn) kan legge seg selv på og fjerne seg", async () => {
  const t = (await as(child.uid, "insert into items (workspace_id, kind, title) values ($1, 'task', 'Pakk sekk') returning id", [fam]))[0].id;
  await as(child.uid, "insert into item_people (item_id, profile_id) values ($1, $2)", [t, child.pid]);
  eq((await as(child.uid, "delete from item_people where item_id = $1 returning 1", [t])).length, 1);
});

await test("flyttes elementet til et annet område, forsvinner personer som ikke er med der", async () => {
  const privat = (await one("select id from workspaces where owner_profile_id = $1 and kind = 'private'", [famOwner.pid])).id;
  await as(famOwner.uid, "update items set workspace_id = $1 where id = $2", [privat, kamp]);
  const rows = await sql("select profile_id, workspace_id from item_people where item_id = $1", [kamp]);
  eq(rows.map((r) => [r.profile_id, r.workspace_id]), [[famOwner.pid, privat]]);
  await as(famOwner.uid, "update items set workspace_id = $1 where id = $2", [fam, kamp]);
});

await test("slettes elementet, slettes personene", async () => {
  await as(famOwner.uid, "delete from items where id = $1", [kamp]);
  eq((await sql("select * from item_people where item_id = $1", [kamp])).length, 0);
});

await test("assignee_profile_id er erstattet av item_people", async () => {
  eq((await sql("select 1 from information_schema.columns where table_name = 'items' and column_name = 'assignee_profile_id'")).length, 0);
});

// ── Handleliste: rydde, legge tilbake og logg ───────────────────
const shopList = (await one("select id from projects where workspace_id = $1 and kind = 'list'", [fam])).id;
const listEvents = (title) => sql("select action::text as action, profile_id from list_events where title = $1 order by id", [title]);

await test("barnet kan rydde varer andre har lagt inn (skjules, slettes ikke)", async () => {
  const melk = (await as(famOwner.uid, "insert into items (workspace_id, project_id, kind, title) values ($1, $2, 'task', 'Lettmelk') returning id", [fam, shopList]))[0].id;
  await as(child.uid, "update items set status = 'done' where id = $1", [melk]);
  eq((await as(child.uid, "update items set cleared_at = now() where project_id = $1 and status = 'done' and cleared_at is null returning id", [shopList])).map((r) => r.id), [melk]);
  eq((await one("select cleared_at is not null as cleared from items where id = $1", [melk])).cleared, true, "raden finnes fortsatt");
});

await test("loggen viser hvem som la til, krysset av og ryddet", async () => {
  eq((await listEvents("Lettmelk")).map((e) => [e.action, e.profile_id]), [
    ["added", famOwner.pid],
    ["checked", child.pid],
    ["cleared", child.pid],
  ]);
});

await test("legge tilbake (angre eller «Nylig handlet») logges", async () => {
  const melk = (await one("select id from items where title = 'Lettmelk'")).id;
  await as(child.uid, "update items set cleared_at = null where id = $1", [melk]);
  await as(famOwner.uid, "update items set status = 'ready' where id = $1", [melk]);
  eq((await listEvents("Lettmelk")).slice(3).map((e) => e.action), ["restored", "unchecked"]);
});

await test("tilbake fra «Nylig handlet» i én endring logges som lagt tilbake", async () => {
  const brod = (await as(famOwner.uid, "insert into items (workspace_id, project_id, kind, title, status, cleared_at) values ($1, $2, 'task', 'Brød', 'done', now()) returning id", [fam, shopList]))[0].id;
  await as(child.uid, "update items set status = 'ready', cleared_at = null where id = $1", [brod]);
  eq((await listEvents("Brød")).map((e) => e.action), ["added", "restored"]);
});

await test("sletting logges, og loggen blir stående", async () => {
  const egg = (await as(child.uid, "insert into items (workspace_id, project_id, kind, title) values ($1, $2, 'task', 'Egg') returning id", [fam, shopList]))[0].id;
  await as(child.uid, "delete from items where id = $1", [egg]);
  eq((await listEvents("Egg")).map((e) => e.action), ["added", "deleted"]);
});

await test("bare voksne kan lese loggen, og ingen kan skrive i den", async () => {
  eq((await as(famOwner.uid, "select 1 from list_events where workspace_id = $1", [fam])).length > 0, true, "forelderen ser loggen");
  eq((await as(child.uid, "select 1 from list_events")).length, 0, "barnet ser ingenting");
  eq((await as(B.uid, "select 1 from list_events")).length, 0, "utenforstående ser ingenting");
  await fails(as(famOwner.uid, "insert into list_events (workspace_id, project_id, title, action) values ($1, $2, 'Falsk', 'added')", [fam, shopList]), /permission denied/);
  await fails(as(famOwner.uid, "delete from list_events"), /permission denied/);
  await fails(asAnon("select * from list_events"), /permission denied/);
});

await test("vanlige prosjekter logges ikke", async () => {
  const proj = (await as(famOwner.uid, "insert into projects (workspace_id, name) values ($1, 'Hytta') returning id", [fam]))[0].id;
  await as(famOwner.uid, "insert into items (workspace_id, project_id, kind, title) values ($1, $2, 'task', 'Male gjerdet')", [fam, proj]);
  eq((await listEvents("Male gjerdet")).length, 0);
});

console.log(`\n${passed} bestått, ${failures.length} feilet\n`);
process.exit(failures.length ? 1 : 0);
