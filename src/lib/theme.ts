export const THEMES = [
  { id: "brown", label: "Brown" },
  { id: "ink", label: "Ink" },
  { id: "olive", label: "Olive" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const KEY = "buddy-system-theme";

export function isTheme(v: string | null | undefined): v is ThemeId {
  return THEMES.some((t) => t.id === v);
}

export function loadTheme(): ThemeId {
  if (typeof window === "undefined") return "brown";
  try {
    const v = localStorage.getItem(KEY);
    return isTheme(v) ? v : "brown";
  } catch {
    return "brown";
  }
}

export function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", id);
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // private mode
  }
}
