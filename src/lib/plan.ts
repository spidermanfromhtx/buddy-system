export const FREE_SESSIONS = 8;
export const FREE_MAX_MIN = 45;
export const PLUS_MAX_MIN = 120;
export const PLUS_PRICE_LABEL = "$5 a month";

export type PlanName = "free" | "plus";

export function isPlus(plan: string | null | undefined) {
  return plan === "plus";
}

export function maxSessionMin(plan: string | null | undefined) {
  return isPlus(plan) ? PLUS_MAX_MIN : FREE_MAX_MIN;
}

export function sessionsLeft(plan: string | null | undefined, used: number) {
  if (isPlus(plan)) return Infinity;
  return Math.max(0, FREE_SESSIONS - used);
}
