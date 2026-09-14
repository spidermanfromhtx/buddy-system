import { rndLimitsOn } from "@/lib/admin.server";
import { getSql, type Sql } from "@/lib/db";
import { FREE_MAX_MIN, FREE_SESSIONS, FREE_WEEK_MS, PLUS_MAX_MIN, PLUS_PRICE_LABEL, isPlus, weeklyUsed } from "@/lib/plan";

export type SessionGate =
  | { ok: true; plan: string; sessionsUsed: number; maxMin: number }
  | { ok: false; error: string; code: "paywall" | "length" | "signin" };

export async function planForPeer(sql: Sql, peerId: string) {
  const rows = await sql.query(
    `SELECT plan, sessions_used, sessions_week_start, limits_on FROM accounts WHERE id = $1 LIMIT 1`,
    [peerId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    plan: String(row.plan || "free"),
    sessionsUsed: weeklyUsed(row.sessions_used, row.sessions_week_start),
    weekStart: row.sessions_week_start ? String(row.sessions_week_start) : null,
    limitsOn: Boolean(row.limits_on),
  };
}

export async function takeSession(sql: Sql, peerId: string, lengthMin: number): Promise<SessionGate> {
  const found = await planForPeer(sql, peerId);
  if (!found) return { ok: false, error: "Sign in again.", code: "signin" };
  const plus = isPlus(found.plan);
  const limitsOn = await rndLimitsOn(sql);
  const maxMin = plus || !limitsOn ? PLUS_MAX_MIN : FREE_MAX_MIN;
  if (lengthMin > maxMin) {
    return {
      ok: false,
      code: "length",
      error: plus || !limitsOn
        ? `Calls can be up to ${PLUS_MAX_MIN} minutes.`
        : `Free sessions are ${FREE_MAX_MIN} minutes. ${PLUS_PRICE_LABEL} unlocks longer calls.`,
    };
  }
  if (!plus && limitsOn && found.sessionsUsed >= FREE_SESSIONS) {
    return {
      ok: false,
      code: "paywall",
      error: `You've used this week's ${FREE_SESSIONS} free sessions. ${PLUS_PRICE_LABEL} for unlimited.`,
    };
  }
  if (!plus && limitsOn) {
    const start = Date.parse(String(found.weekStart ?? ""));
    const freshWeek = !Number.isFinite(start) || Date.now() - start >= FREE_WEEK_MS;
    if (freshWeek) {
      await sql.query(`UPDATE accounts SET sessions_used = 1, sessions_week_start = now() WHERE id = $1`, [peerId]);
      found.sessionsUsed = 1;
    } else {
      await sql.query(`UPDATE accounts SET sessions_used = sessions_used + 1 WHERE id = $1`, [peerId]);
      found.sessionsUsed += 1;
    }
  }
  return { ok: true, plan: found.plan, sessionsUsed: found.sessionsUsed, maxMin };
}

export async function markPlan(accountId: string, customerId: string, subscriptionId: string, plan: "plus" | "pro") {
  const sql = await getSql();
  await sql.query(
    `UPDATE accounts SET plan = $4, stripe_customer_id = $2, stripe_subscription_id = $3 WHERE id = $1`,
    [accountId, customerId, subscriptionId, plan],
  );
}

export async function markPlus(accountId: string, customerId: string, subscriptionId: string) {
  await markPlan(accountId, customerId, subscriptionId, "plus");
}

export async function markFreeByCustomer(customerId: string) {
  const sql = await getSql();
  await sql.query(`UPDATE accounts SET plan = 'free', stripe_subscription_id = null WHERE stripe_customer_id = $1`, [
    customerId,
  ]);
}

export async function markPlusByCustomer(customerId: string, subscriptionId: string, plan: "plus" | "pro" = "plus") {
  const sql = await getSql();
  await sql.query(`UPDATE accounts SET plan = $3, stripe_subscription_id = $2 WHERE stripe_customer_id = $1`, [
    customerId,
    subscriptionId,
    plan,
  ]);
}