import { randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import { hashCode, hashesEqual, mailErrorMessage, sendCodeEmail, sixDigit } from "@/lib/mail-code.server";
import { parseCategories, serializeCategories } from "@/lib/categories";
import { weeklyUsed } from "@/lib/plan";
import { isEmail, normalizeEmail } from "@/lib/school";
import { ageFromBirthdate, newId } from "@/lib/utils";

export type AccountRow = {
  id: string;
  email: string;
  name: string;
  birthdate: string;
  color: string;
  photo: string | null;
  breakEveryMin: number;
  sessionToken: string;
  categories: string[];
  plan: string;
  sessionsUsed: number;
  limitsOn: boolean;
};

function mapAccount(r: Record<string, unknown>): AccountRow {
  return {
    id: String(r.id),
    email: String(r.email),
    name: String(r.name),
    birthdate: String(r.birthdate),
    color: String(r.color),
    photo: r.photo ? String(r.photo) : null,
    breakEveryMin: Number(r.break_every_min ?? 30),
    sessionToken: String(r.session_token),
    categories: parseCategories(r.categories),
    plan: String(r.plan || "free"),
    sessionsUsed: weeklyUsed(r.sessions_used, r.sessions_week_start),
    limitsOn: Boolean(r.limits_on),
  };
}

export async function sendAccountCode(data: { email: string }) {
  const email = normalizeEmail(data.email);
  if (!isEmail(email)) return { ok: false as const, error: "Enter a real email address." };
  const sql = await getSql();
  const recent = await sql.query(`SELECT created_at FROM account_codes WHERE email = $1 LIMIT 1`, [email]);
  if (recent[0]) {
    const made = Date.parse(String(recent[0].created_at));
    if (Number.isFinite(made) && Date.now() - made < 45_000) {
      return { ok: false as const, error: "Wait a moment, then send another code." };
    }
  }
  const code = sixDigit();
  await sql.query(
    `INSERT INTO account_codes (email, code_hash, expires_at, attempts, created_at)
     VALUES ($1,$2, now() + interval '10 minutes', 0, now())
     ON CONFLICT (email) DO UPDATE SET
       code_hash = EXCLUDED.code_hash,
       expires_at = EXCLUDED.expires_at,
       attempts = 0,
       created_at = now()`,
    [email, hashCode(email, code)],
  );
  try {
    await sendCodeEmail(email, code, "account");
  } catch (err) {
    console.error("account email failed", err);
    await sql.query(`DELETE FROM account_codes WHERE email = $1`, [email]).catch(() => undefined);
    return { ok: false as const, error: mailErrorMessage(err) };
  }
  return { ok: true as const };
}

export async function checkAccountCode(data: { email: string; code: string }) {
  const email = normalizeEmail(data.email);
  const sql = await getSql();
  const rows = await sql.query(`SELECT * FROM account_codes WHERE email = $1 LIMIT 1`, [email]);
  const row = rows[0];
  if (!row) return { ok: false as const, error: "Send a code first." };
  const expires = Date.parse(String(row.expires_at));
  if (!Number.isFinite(expires) || expires < Date.now()) {
    return { ok: false as const, error: "That code expired. Send a new one." };
  }
  const attempts = Number(row.attempts ?? 0);
  if (attempts >= 5) return { ok: false as const, error: "Too many tries. Send a new code." };
  if (!hashesEqual(String(row.code_hash), hashCode(email, data.code))) {
    await sql.query(`UPDATE account_codes SET attempts = attempts + 1 WHERE email = $1`, [email]);
    return { ok: false as const, error: "That code does not match." };
  }
  await sql.query(`DELETE FROM account_codes WHERE email = $1`, [email]);
  const token = randomBytes(24).toString("hex");
  const existing = await sql.query(`SELECT * FROM accounts WHERE email = $1 LIMIT 1`, [email]);
  if (existing[0]) {
    await sql.query(`UPDATE accounts SET session_token = $2 WHERE email = $1`, [email, token]);
    return { ok: true as const, exists: true as const, token, account: { ...mapAccount(existing[0]), sessionToken: token } };
  }
  await sql.query(
    `INSERT INTO account_pending (email, session_token, expires_at, created_at)
     VALUES ($1,$2, now() + interval '30 minutes', now())
     ON CONFLICT (email) DO UPDATE SET
       session_token = EXCLUDED.session_token,
       expires_at = EXCLUDED.expires_at,
       created_at = now()`,
    [email, token],
  );
  return { ok: true as const, exists: false as const, token, email };
}

export async function createAccount(data: {
  email: string;
  token: string;
  name: string;
  birthdate: string;
  color: string;
  photo: string | null;
  categories: string[];
}) {
  const email = normalizeEmail(data.email);
  if (ageFromBirthdate(data.birthdate) < 18) {
    return { ok: false as const, error: "You must be 18 or older." };
  }
  if (!data.name.trim()) return { ok: false as const, error: "Name is required." };
  const categories = parseCategories(data.categories);
  if (!categories.length) return { ok: false as const, error: "Pick at least one category." };
  const sql = await getSql();
  const pending = await sql.query(
    `SELECT * FROM account_pending WHERE email = $1 AND session_token = $2 AND expires_at > now() LIMIT 1`,
    [email, data.token],
  );
  if (!pending[0]) return { ok: false as const, error: "Verify your email first." };
  const id = newId("p");
  await sql.query(
    `INSERT INTO accounts (id, email, session_token, name, birthdate, color, photo, break_every_min, categories)
     VALUES ($1,$2,$3,$4,$5,$6,$7,30,$8)`,
    [id, email, data.token, data.name.trim(), data.birthdate, data.color, data.photo, serializeCategories(categories)],
  );
  await sql.query(`DELETE FROM account_pending WHERE email = $1`, [email]);
  return {
    ok: true as const,
    account: {
      id,
      email,
      name: data.name.trim(),
      birthdate: data.birthdate,
      color: data.color,
      photo: data.photo,
      breakEveryMin: 30,
      sessionToken: data.token,
      categories,
      plan: "free",
      sessionsUsed: 0,
      limitsOn: false,
    },
  };
}

export async function saveAccount(data: {
  token: string;
  name?: string;
  color?: string;
  photo?: string | null;
  breakEveryMin?: number;
  categories?: string[];
  limitsOn?: boolean;
}) {
  const sql = await getSql();
  const rows = await sql.query(`SELECT * FROM accounts WHERE session_token = $1 LIMIT 1`, [data.token]);
  if (!rows[0]) return { ok: false as const, error: "Sign in again." };
  const cur = mapAccount(rows[0]);
  const name = data.name?.trim() || cur.name;
  const color = data.color ?? cur.color;
  const photo = data.photo === undefined ? cur.photo : data.photo;
  const breakEveryMin = data.breakEveryMin ?? cur.breakEveryMin;
  const categories = data.categories ? parseCategories(data.categories) : cur.categories;
  const limitsOn = data.limitsOn ?? cur.limitsOn;
  if (data.categories && !categories.length) return { ok: false as const, error: "Pick at least one category." };
  await sql.query(
    `UPDATE accounts SET name = $2, color = $3, photo = $4, break_every_min = $5, categories = $6, limits_on = $7 WHERE session_token = $1`,
    [data.token, name, color, photo, breakEveryMin, serializeCategories(categories), limitsOn],
  );
  return { ok: true as const };
}

export async function readAccount(token: string) {
  const sql = await getSql();
  const rows = await sql.query(`SELECT * FROM accounts WHERE session_token = $1 LIMIT 1`, [token]);
  if (!rows[0]) return { ok: false as const, error: "Sign in again." };
  return { ok: true as const, account: mapAccount(rows[0]) };
}
