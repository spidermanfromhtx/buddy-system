const KEY = "buddy-system-alarms";

export type Alarm = {
  id: string;
  start: number;
  end: number;
  task: string;
  urgent: boolean;
  lengthMin: number;
  camera: boolean;
};

export function loadAlarms(): Alarm[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw) as Alarm[];
    return rows.filter((a) => Number.isFinite(a.start) && Number.isFinite(a.end) && a.end > Date.now() - 60_000);
  } catch {
    return [];
  }
}

export function saveAlarm(alarm: Alarm) {
  const next = loadAlarms().filter((a) => a.id !== alarm.id);
  next.push(alarm);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function dropAlarm(id: string) {
  localStorage.setItem(KEY, JSON.stringify(loadAlarms().filter((a) => a.id !== id)));
}

export function parseStamp(value: string | null | undefined) {
  if (!value) return NaN;
  const direct = Date.parse(value);
  if (Number.isFinite(direct)) return direct;
  return Date.parse(value.replace(" ", "T"));
}
