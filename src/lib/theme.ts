export const NONE = "";
export const HOUSE = "#6b5cff";
export const HOUSE_INK = "#1c1933";

export const COLOR_THEMES = [
  { id: "red", color: "#e7a6a6", label: "Red" },
  { id: "orange", color: "#efc39a", label: "Orange" },
  { id: "yellow", color: "#e6d59a", label: "Yellow" },
  { id: "green", color: "#a9d4b8", label: "Green" },
  { id: "blue", color: "#a7c6ea", label: "Blue" },
  { id: "indigo", color: "#b4b0e0", label: "Indigo" },
  { id: "violet", color: "#d2b5d8", label: "Violet" },
] as const;

export type ThemeId = (typeof COLOR_THEMES)[number]["id"];

export const COLORS = COLOR_THEMES.map((t) => t.color);

const OLD: Record<string, string> = {
  "#e7a6a6": "#e7a6a6",
  "#efc39a": "#efc39a",
  "#e6d59a": "#e6d59a",
  "#a9d4b8": "#a9d4b8",
  "#a7c6ea": "#a7c6ea",
  "#b4b0e0": "#b4b0e0",
  "#d2b5d8": "#d2b5d8",
  "#e56b5a": "#e7a6a6",
  "#c45c3e": "#e7a6a6",
  "#e05a84": "#d2b5d8",
  "#8b7cc8": "#b4b0e0",
  "#4a7fd4": "#a7c6ea",
  "#3d6ea8": "#a7c6ea",
  "#4aa3c4": "#a7c6ea",
  "#e8894a": "#efc39a",
  "#c9a227": "#e6d59a",
  "#c45a78": "#d2b5d8",
  "#2f6f5e": "#a9d4b8",
  "#7a3e5c": "#d2b5d8",
  "#4a7c8c": "#a7c6ea",
  "#5c6b3a": "#a9d4b8",
};

export function normalizeColor(color: string | null | undefined) {
  const key = (color || "").toLowerCase().trim();
  if (!key || key === "default" || key === "none") return NONE;
  if ((COLORS as string[]).includes(key)) return key;
  return OLD[key] ?? NONE;
}

export function themeForColor(color: string | null | undefined) {
  const hex = normalizeColor(color);
  if (!hex) return { id: "default" as const, color: NONE, label: "Default" };
  return COLOR_THEMES.find((t) => t.color === hex) ?? { id: "default" as const, color: NONE, label: "Default" };
}

export function applyColorTheme(color: string | null | undefined) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", themeForColor(color).id);
}
