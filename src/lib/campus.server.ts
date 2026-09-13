import { randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import { hashCode, hashesEqual, mailErrorMessage, sendCodeEmail, sixDigit } from "@/lib/mail-code.server";
import { normalizeEmail, schoolFromEmail } from "@/lib/school";

export async function sendCampusCode(data: { email: string; peerId: string }) {
  const email = normalizeEmail(data.email);
  const school = schoolFromEmail(email);
  if (!school) return { ok: false as const, error: "Use a school .edu address, not Gmail." };
  const sql = await getSql();
  const recent = await sql.query(`SELECT created_at FROM campus_codes WHERE email = $1 LIMIT 1`, [email]);
  if (recent[0]) {
    const made = Date.parse(String(recent[0].created_at));
    if (Number.isFinite(made) && Date.now() - made < 45_000) {
      return { ok: false as const, error: "Wait a moment, then send another code." };
    }
  }
  const code = sixDigit();
  await sql.query(
    `INSERT INTO campus_codes (email, peer_id, code_hash, school, expires_at, attempts, created_at)
     VALUES ($1,$2,$3,$4, now() + interval '10 minutes', 0, now())
     ON CONFLICT (email) DO UPDATE SET
       peer_id = EXCLUDED.peer_id,
       code_hash = EXCLUDED.code_hash,
       school = EXCLUDED.school,
       expires_at = EXCLUDED.expires_at,
       attempts = 0,
       created_at = now()`,
    [email, data.peerId, hashCode(email, code), school],
  );
  try {
    await sendCodeEmail(email, code, "campus");
  } catch (err) {
    console.error("campus email failed", err);
    return { ok: false as const, error: mailErrorMessage(err) };
  }
  return { ok: true as const };
}

export async function checkCampusCode(data: { email: string; peerId: string; code: string }) {
  const email = normalizeEmail(data.email);
  const sql = await getSql();
  const rows = await sql.query(`SELECT * FROM campus_codes WHERE email = $1 LIMIT 1`, [email]);
  const row = rows[0];
  if (!row) return { ok: false as const, error: "Send a code first." };
  const expires = Date.parse(String(row.expires_at));
  if (!Number.isFinite(expires) || expires < Date.now()) {
    return { ok: false as const, error: "That code expired. Send a new one." };
  }
  const attempts = Number(row.attempts ?? 0);
  if (attempts >= 5) return { ok: false as const, error: "Too many tries. Send a new code." };
  if (!hashesEqual(String(row.code_hash), hashCode(email, data.code))) {
    await sql.query(`UPDATE campus_codes SET attempts = attempts + 1 WHERE email = $1`, [email]);
    return { ok: false as const, error: "That code does not match." };
  }
  const school = String(row.school);
  const token = randomBytes(24).toString("hex");
  await sql.query(`DELETE FROM campus_codes WHERE email = $1`, [email]);
  await sql.query(`DELETE FROM campus_members WHERE peer_id = $1 OR email = $2`, [data.peerId, email]);
  await sql.query(
    `INSERT INTO campus_members (peer_id, email, school, token, verified_at) VALUES ($1,$2,$3,$4, now())`,
    [data.peerId, email, school, token],
  );
  await sql.query(`UPDATE listings SET school = $2 WHERE peer_id = $1`, [data.peerId, school]);
  return { ok: true as const, school, token, email };
}
