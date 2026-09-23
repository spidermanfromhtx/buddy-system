import { randomBytes } from "node:crypto";
import { getSql, type Sql } from "@/lib/db";
import { inviteAdmin as addAdmin, isAdmin, listAdmins, rndLimitsOn, setRndLimits } from "@/lib/admin.server";
import { parseCategories, serializeCategories } from "@/lib/categories";
import { hashCode, hashesEqual, mailErrorMessage, sendCodeEmail, sixDigit } from "@/lib/mail-code.server";
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
  plusGrantUntil: string | null;
  limitsOn: boolean;
  admin: boolean;
};

function mapAccount(r: Record<string, unknown>): Omit<AccountRow, "limitsOn" | "admin"> {
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
    plusGrantUntil: r.plus_grant_until ? String(r.plus_grant_until) : null,
  };
}

async function decorate(sql: Sql, account: Omit<AccountRow, "limitsOn" | "admin">): Promise<AccountRow> {
  if (account.plusGrantUntil && Date.parse(account.plusGrantUntil) <= Date.now() && !account.email) {
    // unreachable guard keeps the promo check scoped to the server-side account object
  }
  if (account.plusGrantUntil && Date.parse(account.plusGrantUntil) <= Date.now() && account.plan === "plus") {
    await sql.query(
      `UPDATE accounts SET plan = 'free', plus_grant_until = null
       WHERE id = $1 AND plan = 'plus' AND plus_grant_until IS NOT NULL AND plus_grant_until <= now()`,
      [account.id],
    );
    account.plan = "free";
    account.plusGrantUntil = null;
  }
  const [limitsOn, admin] = await Promise.all([rndLimitsOn(sql), isAdmin(sql, account.email)]);
  if (admin && account.plan !== "free") {
    const paid = await sql.query(`SELECT stripe_subscription_id FROM accounts WHERE id = $1 LIMIT 1`, [account.id]);
    if (!paid[0]?.stripe_subscription_id) {
      await sql.query(`UPDATE accounts SET plan = 'free' WHERE id = $1 AND stripe_subscription_id IS NULL`, [account.id]);
      account.plan = "free";
    }
  }
  return { ...account, limitsOn, admin };
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
    if (existing[0].banned) return { ok: false as const, error: "This account was closed." };
    await sql.query(`UPDATE accounts SET session_token = $2 WHERE email = $1`, [email, token]);
    return {
      ok: true as const,
      exists: true as const,
      token,
      account: await decorate(sql, { ...mapAccount(existing[0]), sessionToken: token }),
    };
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
    `INSERT INTO accounts (id, email, session_token, name, birthdate, color, photo, break_every_min, categories, tos_accepted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,30,$8, now())`,
    [id, email, data.token, data.name.trim(), data.birthdate, data.color, data.photo, serializeCategories(categories)],
  );

  const promo = await sql.query(
    `WITH claimed AS (
       UPDATE launch_plus_slots
       SET account_id = $1
       WHERE slot = (
         SELECT slot FROM launch_plus_slots
         WHERE account_id IS NULL
         ORDER BY slot
         LIMIT 1
       )
       AND account_id IS NULL
       RETURNING slot
     )
     UPDATE accounts
     SET plan = 'plus', plus_grant_until = now() + interval '1 month'
     WHERE id = $1 AND EXISTS (SELECT 1 FROM claimed)
     RETURNING plus_grant_until`,
    [id],
  );
  const promoUntil = promo[0]?.plus_grant_until ? String(promo[0].plus_grant_until) : null;
  const plan = promoUntil ? "plus" : "free";

  await sql.query(`DELETE FROM account_pending WHERE email = $1`, [email]);
  return {
    ok: true as const,
    account: await decorate(sql, {
      id,
      email,
      name: data.name.trim(),
      birthdate: data.birthdate,
      color: data.color,
      photo: data.photo,
      breakEveryMin: 30,
      sessionToken: data.token,
      categories,
      plan,
      sessionsUsed: 0,
      plusGrantUntil: promoUntil,
    }),
  };
}

export async function saveAccount(data: {
  token: string;
  name?: string;
  color?: string;
  photo?: string | null;
  breakEveryMin?: number;
  categories?: string[];
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
  if (data.categories && !categories.length) return { ok: false as const, error: "Pick at least one category." };
  await sql.query(
    `UPDATE accounts SET name = $2, color = $3, photo = $4, break_every_min = $5, categories = $6 WHERE session_token = $1`,
    [data.token, name, color, photo, breakEveryMin, serializeCategories(categories)],
  );
  return { ok: true as const };
}

export async function readAccount(token: string) {
  const sql = await getSql();
  const rows = await sql.query(`SELECT * FROM accounts WHERE session_token = $1 LIMIT 1`, [token]);
  if (!rows[0]) return { ok: false as const, error: "Sign in again." };
  return { ok: true as const, account: await decorate(sql, mapAccount(rows[0])) };
}

export async function setRndMode(token: string, on: boolean) {
  const sql = await getSql();
  const rows = await sql.query(`SELECT email FROM accounts WHERE session_token = $1 LIMIT 1`, [token]);
  if (!rows[0]) return { ok: false as const, error: "Sign in again." };
  if (!(await isAdmin(sql, String(rows[0].email)))) {
    return { ok: false as const, error: "Admins only." };
  }
  await setRndLimits(sql, on);
  const limitsOn = await rndLimitsOn(sql);
  return { ok: true as const, limitsOn };
}

export async function inviteAdminEmail(token: string, email: string) {
  const sql = await getSql();
  const rows = await sql.query(`SELECT email FROM accounts WHERE session_token = $1 LIMIT 1`, [token]);
  if (!rows[0]) return { ok: false as const, error: "Sign in again." };
  const by = String(rows[0].email);
  if (!(await isAdmin(sql, by))) return { ok: false as const, error: "Admins only." };
  if (!isEmail(email)) return { ok: false as const, error: "Enter a real email." };
  return addAdmin(sql, email, by);
}

export async function readAdmins(token: string) {
  const sql = await getSql();
  const rows = await sql.query(`SELECT email FROM accounts WHERE session_token = $1 LIMIT 1`, [token]);
  if (!rows[0]) return { ok: false as const, error: "Sign in again." };
  if (!(await isAdmin(sql, String(rows[0].email)))) return { ok: false as const, error: "Admins only." };
  return { ok: true as const, admins: await listAdmins(sql) };
}
