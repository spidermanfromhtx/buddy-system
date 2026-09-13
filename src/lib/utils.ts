import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ageFromBirthdate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

export function formatMmSs(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDue(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatClock(t: string) {
  const [hs, ms] = t.split(":");
  const h = Number(hs);
  const m = Number(ms);
  if (Number.isNaN(h)) return t;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(Number.isNaN(m) ? 0 : m).padStart(2, "0")}${suffix}`;
}

export function formatWindow(date: string, start: string, end: string) {
  const d = new Date(date.length <= 10 ? `${date}T12:00:00` : date);
  const day = Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${formatClock(start)}–${formatClock(end)}`;
}

export function windowRange(date: string, start: string, end: string) {
  const startMs = new Date(`${date}T${start}:00`).getTime();
  let endMs = new Date(`${date}T${end}:00`).getTime();
  if (Number.isNaN(startMs)) {
    return { start: new Date().toISOString(), end: new Date(Date.now() + 60 * 60 * 1000).toISOString() };
  }
  if (Number.isNaN(endMs) || endMs <= startMs) endMs = startMs + 60 * 60 * 1000;
  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}
