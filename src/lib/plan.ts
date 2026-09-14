export const FREE_SESSIONS = 5;
export const FREE_MAX_MIN = 45;
export const PLUS_MAX_MIN = 120;
export const PLUS_PRICE_LABEL = "$5 a month";
export const PRO_PRICE_LABEL = "$8 a month";
export const FREE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type PlanName = "free" | "plus" | "pro";

export function isPaid(plan: string | null | undefined) {
  return plan === "plus" || plan === "pro";
}

export function isPlus(plan: string | null | undefined) {
  return isPaid(plan);
}

export function isPro(plan: string | null | undefined) {
  return plan === "pro";
}

export function canScreenShare(_plan?: string | null, _limitsOn = false) {
  return false;
}

export function limitsEnabled(on: boolean | null | undefined) {
  return Boolean(on);
}

export function maxSessionMin(plan: string | null | undefined, limitsOn = false) {
  if (!limitsEnabled(limitsOn) || isPaid(plan)) return PLUS_MAX_MIN;
  return FREE_MAX_MIN;
}

export function weeklyUsed(used: unknown, weekStart: unknown) {
  const start = Date.parse(String(weekStart ?? ""));
  if (!Number.isFinite(start) || Date.now() - start >= FREE_WEEK_MS) return 0;
  const n = Number(used ?? 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function sessionsLeft(plan: string | null | undefined, used: number, limitsOn = false) {
  if (isPaid(plan) || !limitsEnabled(limitsOn)) return Infinity;
  return Math.max(0, FREE_SESSIONS - used);
}

export function planLabel(plan: string | null | undefined) {
  if (plan === "pro") return "Pro";
  if (plan === "plus") return "Plus";
  return "Free";
}
