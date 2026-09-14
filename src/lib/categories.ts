export const CATEGORIES = [
  { id: "homework", label: "Homework" },
  { id: "project", label: "Project" },
  { id: "work", label: "Work" },
  { id: "gym", label: "Gym" },
  { id: "chores", label: "Chores" },
  { id: "driving", label: "Driving" },
  { id: "errands", label: "Errands" },
  { id: "other", label: "Other" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

const ALLOWED = new Set(CATEGORIES.map((c) => c.id));

const ALIAS: Record<string, CategoryId> = {
  school: "homework",
  drive: "driving",
  creative: "project",
  gym: "gym",
  work: "work",
  chores: "chores",
  errands: "errands",
  other: "other",
  homework: "homework",
  project: "project",
  driving: "driving",
};

export function parseCategories(raw: unknown): CategoryId[] {
  const parts = Array.isArray(raw)
    ? raw.map(String)
    : String(raw ?? "")
        .split(",")
        .map((s) => s.trim());
  const mapped = parts
    .map((id) => ALIAS[id] ?? (ALLOWED.has(id as CategoryId) ? (id as CategoryId) : null))
    .filter((id): id is CategoryId => Boolean(id));
  return [...new Set(mapped)];
}

export function serializeCategories(ids: string[]) {
  return parseCategories(ids).join(",");
}

export function categoryLabel(id: string | null | undefined) {
  if (!id) return "";
  const labels = parseCategories(id).map((c) => CATEGORIES.find((x) => x.id === c)?.label ?? c);
  return labels.join(" · ");
}

export function categoriesOverlap(a: string | null | undefined, b: string | null | undefined) {
  const left = new Set(parseCategories(a));
  if (!left.size) return false;
  return parseCategories(b).some((id) => left.has(id));
}
