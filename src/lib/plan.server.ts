import { getSql, type Sql } from "@/lib/db";
import { FREE_MAX_MIN, FREE_SESSIONS, PLUS_MAX_MIN, PLUS_PRICE_LABEL, isPlus } from "@/lib/plan";

export type SessionGate =
  | { ok: true; plan: string; sessionsUsed: number; maxMin: number }
  | { ok: false; error: string; code: "paywall" | "length" | "signin" };

export async function planForPeer(sql: Sql, peerId: string) {
  const rows = await sql.query(`SELECT plan, sessions_used FROM accounts WHERE id = $1 LIMIT 1`, [peerId]);
  const row = rows[0];
  if (!row) return null;
  return { plan: String(row.plan || "free"), sessionsUsed: Number(row.sessions_used ?? 0) };
}

export async function takeSession(sql: Sql, peerId: string, lengthMin: number): Promise<SessionGate> {
  const found = await planForPeer(sql, peerId);
  if (!found) return { ok: false, error: "Sign in again.", code: "signin" };
  const plus = isPlus(found.plan);
  const maxMin = plus ? PLUS_MAX_MIN : FREE_MAX_MIN;
  if (lengthMin > maxMin) {
    return {
      ok: false,
      code: "length",
      error: plus
        ? `Calls can be up to ${PLUS_MAX_MIN} minutes.`
        : `Free sessions are ${FREE_MAX_MIN} minutes. ${PLUS_PRICE_LABEL} unlocks longer calls.`,
    };
  }
  if (!plus && found.sessionsUsed >= FREE_SESSIONS) {
    return {
      ok: false,
      code: "paywall",
      error: `You've used your ${FREE_SESSIONS} free sessions. ${PLUS_PRICE_LABEL} for unlimited.`,
    };
  }
  if (!plus) {
    await sql.query(`UPDATE accounts SET sessions_used = sessions_used + 1 WHERE id = $1`, [peerId]);
    found.sessionsUsed += 1;
  }
  return { ok: true, plan: found.plan, sessionsUsed: found.sessionsUsed, maxMin };
}

export async function markPlus(accountId: string, customerId: string, subscriptionId: string) {
  const sql = await getSql();
  await sql.query(
    `UPDATE accounts SET plan = 'plus', stripe_customer_id = $2, stripe_subscription_id = $3 WHERE id = $1`,
    [accountId, customerId, subscriptionId],
  );
}

export async function markFreeByCustomer(customerId: string) {
  const sql = await getSql();
  await sql.query(`UPDATE accounts SET plan = 'free', stripe_subscription_id = null WHERE stripe_customer_id = $1`, [
    customerId,
  ]);
}

export async function markPlusByCustomer(customerId: string, subscriptionId: string) {
  const sql = await getSql();
  await sql.query(`UPDATE accounts SET plan = 'plus', stripe_subscription_id = $2 WHERE stripe_customer_id = $1`, [
    customerId,
    subscriptionId,
  ]);
}
