export const CATEGORIES = [
  { id: "school", label: "School" },
  { id: "work", label: "Work" },
  { id: "chores", label: "Chores" },
  { id: "gym", label: "Gym / getting there" },
  { id: "errands", label: "Errands / out of the car" },
  { id: "drive", label: "Driving" },
  { id: "creative", label: "Creative" },
  { id: "other", label: "Other" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

const ALLOWED = new Set(CATEGORIES.map((c) => c.id));

export function parseCategories(raw: unknown): CategoryId[] {
  const parts = Array.isArray(raw)
    ? raw.map(String)
    : String(raw ?? "")
        .split(",")
        .map((s) => s.trim());
  return [...new Set(parts.filter((id): id is CategoryId => ALLOWED.has(id as CategoryId)))];
}

export function serializeCategories(ids: string[]) {
  return parseCategories(ids).join(",");
}

export function categoryLabel(id: string | null | undefined) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "";
}
