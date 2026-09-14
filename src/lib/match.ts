const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "just",
  "into",
  "out",
  "get",
  "got",
  "start",
  "finish",
  "dont",
  "don't",
  "when",
  "then",
  "your",
  "you",
  "off",
]);

export function taskTokens(task: string) {
  return task
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export function tasksSimilar(a: string, b: string) {
  const left = new Set(taskTokens(a));
  if (left.size === 0) return false;
  return taskTokens(b).some((w) => left.has(w));
}

export function listingsSimilar(a: { task: string; category?: string | null }, b: { task: string; category?: string | null }) {
  if (a.category && b.category) return a.category === b.category;
  return tasksSimilar(a.task, b.task);
}

export function prefsFit(aPref: string, bPref: string, similar: boolean) {
  const ok = (pref: string) => {
    if (pref === "similar") return similar;
    if (pref === "different") return !similar;
    return true;
  };
  return ok(aPref) && ok(bPref);
}

export function sid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
