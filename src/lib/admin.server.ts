import { type Sql } from "@/lib/db";
import { normalizeEmail } from "@/lib/school";

const BOOTSTRAP = ["spidermanfromtx@icloud.com"];

export function bootstrapAdmins() {
  const extra = (process.env.ADMIN_EMAILS || "")
    .split(/[,;\s]+/)
    .map((s) => normalizeEmail(s))
    .filter(Boolean);
  return [...new Set([...BOOTSTRAP.map(normalizeEmail), ...extra])];
}

export async function ensureAdminTables(sql: Sql) {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key text PRIMARY KEY,
      value text NOT NULL
    )
  `);
  await sql.query(`INSERT INTO app_meta (key, value) VALUES ('rnd_limits', 'off') ON CONFLICT (key) DO NOTHING`);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS admins (
      email text PRIMARY KEY,
      invited_by text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function isAdmin(sql: Sql, email: string) {
  const e = normalizeEmail(email);
  if (bootstrapAdmins().includes(e)) return true;
  await ensureAdminTables(sql);
  const rows = await sql.query(`SELECT 1 FROM admins WHERE email = $1 LIMIT 1`, [e]);
  return Boolean(rows[0]);
}

export async function rndLimitsOn(sql: Sql) {
  await ensureAdminTables(sql);
  const rows = await sql.query(`SELECT value FROM app_meta WHERE key = 'rnd_limits' LIMIT 1`);
  return String(rows[0]?.value ?? "off") === "on";
}

export async function setRndLimits(sql: Sql, on: boolean) {
  await ensureAdminTables(sql);
  const value = on ? "on" : "off";
  await sql.query(`DELETE FROM app_meta WHERE key = 'rnd_limits'`);
  await sql.query(`INSERT INTO app_meta (key, value) VALUES ('rnd_limits', $1)`, [value]);
}

export async function listAdmins(sql: Sql) {
  await ensureAdminTables(sql);
  const rows = await sql.query(`SELECT email FROM admins`);
  const invited = rows.map((r) => normalizeEmail(String(r.email)));
  return [...new Set([...bootstrapAdmins(), ...invited])].sort();
}

export async function inviteAdmin(sql: Sql, email: string, by: string) {
  await ensureAdminTables(sql);
  const e = normalizeEmail(email);
  if (!e.includes("@")) return { ok: false as const, error: "Enter a real email." };
  await sql.query(
    `INSERT INTO admins (email, invited_by) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`,
    [e, normalizeEmail(by)],
  );
  return { ok: true as const, admins: await listAdmins(sql) };
}
