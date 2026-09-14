export const THEMES = [
  { id: "stone", label: "Stone", tried: false },
  { id: "brown", label: "Brown", tried: true },
  { id: "ink", label: "Ink", tried: true },
  { id: "olive", label: "Olive", tried: true },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "stone";

const KEY = "buddy-system-theme-v3";

export function isTheme(v: string | null | undefined): v is ThemeId {
  return THEMES.some((t) => t.id === v);
}

export function loadTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const v = localStorage.getItem(KEY);
    return isTheme(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
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

export function triedThemes() {
  return THEMES.filter((t) => t.tried).map((t) => t.label);
}
