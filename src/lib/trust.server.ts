import { getSql } from "@/lib/db";
import { sendMail } from "@/lib/mail-code.server";
import { newId } from "@/lib/utils";

const HIGH =
  /\b(rape|rapist|molest|predator|pedo|paedo|csam|underage|child\s*porn|kill you|murder|stab|gun|weapon|assault|strangle|traffick|behead|bomb)\b/i;
const MEDIUM =
  /\b(harass|stalk|creep|doxx|dox|nudes|unsafe|threaten|follow me|phone number|home address|exposed me|sexual)\b/i;

export function rankSeverity(text: string): "high" | "medium" | "low" {
  const t = text.trim();
  if (!t) return "low";
  if (HIGH.test(t)) return "high";
  if (MEDIUM.test(t)) return "medium";
  return "low";
}

async function accountByToken(token: string) {
  const sql = await getSql();
  const rows = await sql.query(`SELECT * FROM accounts WHERE session_token = $1 LIMIT 1`, [token]);
  return rows[0] ?? null;
}

async function accountById(id: string) {
  const sql = await getSql();
  const rows = await sql.query(`SELECT * FROM accounts WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function leaveReview(data: {
  token: string;
  subjectId: string;
  callId?: string;
  rating: number;
  body: string;
}) {
  const me = await accountByToken(data.token);
  if (!me) return { ok: false as const, error: "Sign in again." };
  if (String(me.id) === data.subjectId) return { ok: false as const, error: "You cannot rate yourself." };
  const rating = Math.min(5, Math.max(1, Math.round(data.rating)));
  const body = data.body.trim().slice(0, 280);
  const sql = await getSql();
  if (data.callId) {
    const had = await sql.query(
      `SELECT id FROM reviews WHERE reviewer_id = $1 AND call_id = $2 LIMIT 1`,
      [me.id, data.callId],
    );
    if (had[0]) return { ok: false as const, error: "You already rated this call." };
  }
  await sql.query(
    `INSERT INTO reviews (id, call_id, reviewer_id, subject_id, rating, body, created_at)
     VALUES ($1,$2,$3,$4,$5,$6, now())`,
    [newId("rv"), data.callId ?? null, me.id, data.subjectId, rating, body],
  );
  return { ok: true as const };
}

export async function listReviews() {
  const sql = await getSql();
  const rows = await sql.query(
    `SELECT r.rating, r.body, r.created_at, a.name, a.color, a.photo
     FROM reviews r
     JOIN accounts a ON a.id = r.subject_id
     WHERE a.banned = false
     ORDER BY r.created_at DESC
     LIMIT 40`,
  );
  return rows.map((r) => ({
    name: String(r.name),
    color: String(r.color || ""),
    photo: r.photo ? String(r.photo) : null,
    rating: Number(r.rating),
    body: String(r.body || ""),
    createdAt: String(r.created_at),
  }));
}

async function ensureAppReviews() {
  const sql = await getSql();
  await sql.query(`
    create table if not exists app_reviews (
      id text primary key,
      reviewer_id text not null unique,
      rating integer not null,
      body text not null default '',
      created_at timestamptz not null default now()
    )
  `);
  return sql;
}

export async function leaveAppReview(data: { token: string; rating: number; body: string }) {
  const me = await accountByToken(data.token);
  if (!me) return { ok: false as const, error: "Sign in again." };
  const rating = Math.min(5, Math.max(1, Math.round(data.rating)));
  const body = data.body.trim().slice(0, 280);
  if (!body) return { ok: false as const, error: "Write a few words." };
  const sql = await ensureAppReviews();
  const had = await sql.query(`SELECT id FROM app_reviews WHERE reviewer_id = $1 LIMIT 1`, [me.id]);
  if (had[0]) {
    await sql.query(`UPDATE app_reviews SET rating = $2, body = $3, created_at = now() WHERE reviewer_id = $1`, [
      me.id,
      rating,
      body,
    ]);
  } else {
    await sql.query(`INSERT INTO app_reviews (id, reviewer_id, rating, body, created_at) VALUES ($1,$2,$3,$4, now())`, [
      newId("arv"),
      me.id,
      rating,
      body,
    ]);
  }
  return { ok: true as const, review: { name: String(me.name), rating, body, createdAt: new Date().toISOString() } };
}

export async function listAppReviews() {
  try {
    const sql = await ensureAppReviews();
    const rows = await sql.query(
      `SELECT r.rating, r.body, r.created_at, a.name
     FROM app_reviews r
     LEFT JOIN accounts a ON a.id = r.reviewer_id
     WHERE COALESCE(a.banned, false) = false
     ORDER BY r.created_at DESC
     LIMIT 500`,
    );
    return rows.map((r) => ({
      name: String(r.name || "Buddy"),
      rating: Number(r.rating),
      body: String(r.body || ""),
      createdAt: String(r.created_at),
    }));
  } catch (err) {
    console.error("listAppReviews", err);
    return [];
  }
}

export async function ratingsMap() {
  const sql = await getSql();
  const rows = await sql.query(
    `SELECT subject_id, avg(rating)::float as avg, count(*)::int as n
     FROM reviews GROUP BY subject_id`,
  );
  const out: Record<string, { avg: number; n: number }> = {};
  for (const r of rows) {
    out[String(r.subject_id)] = { avg: Number(r.avg), n: Number(r.n) };
  }
  return out;
}

export async function fileReport(data: {
  token: string;
  subjectId: string;
  callId?: string;
  body: string;
}) {
  const me = await accountByToken(data.token);
  if (!me) return { ok: false as const, error: "Sign in again." };
  const body = data.body.trim().slice(0, 800);
  if (body.length < 8) return { ok: false as const, error: "Tell us what happened." };
  if (String(me.id) === data.subjectId) return { ok: false as const, error: "You cannot report yourself." };
  const subject = await accountById(data.subjectId);
  if (!subject) return { ok: false as const, error: "That person is gone." };
  const severity = rankSeverity(body);
  const sql = await getSql();
  let action = "logged";
  const warns = Number(subject.warn_count ?? 0);
  if (severity === "high" || (severity === "medium" && warns >= 1) || (severity === "low" && warns >= 3)) {
    action = "closed";
    await sql.query(`UPDATE accounts SET banned = true, warn_count = $2 WHERE id = $1`, [subject.id, warns + 1]);
    await sendMail(
      String(subject.email),
      "Your Buddy System account was closed",
      "A safety report met our close threshold. This account can no longer sign in. If you think this was a mistake, reply to this email.",
    ).catch((err) => console.error("ban mail failed", err));
  } else if (severity === "medium" || (severity === "low" && warns >= 1)) {
    action = "warned";
    await sql.query(`UPDATE accounts SET warn_count = $2 WHERE id = $1`, [subject.id, warns + 1]);
    await sendMail(
      String(subject.email),
      "A warning from Buddy System",
      "Someone reported a call or your listing. We reviewed the language in that report and are sending this warning. Another serious report can close the account. Stay 18+. Do not harass. Hang up if a call feels wrong.",
    ).catch((err) => console.error("warn mail failed", err));
  } else {
    await sql.query(`UPDATE accounts SET warn_count = $2 WHERE id = $1`, [subject.id, warns + 1]);
  }
  await sql.query(
    `INSERT INTO reports (id, reporter_id, subject_id, call_id, body, severity, action, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now())`,
    [newId("rp"), me.id, data.subjectId, data.callId ?? null, body, severity, action],
  );
  return { ok: true as const, action };
}
