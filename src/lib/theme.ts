export const COLOR_THEMES = [
  { id: "coral", color: "#e56b5a", label: "Coral" },
  { id: "pink", color: "#e05a84", label: "Pink" },
  { id: "lavender", color: "#8b7cc8", label: "Lavender" },
  { id: "blue", color: "#4a7fd4", label: "Blue" },
  { id: "sky", color: "#4aa3c4", label: "Sky" },
  { id: "apricot", color: "#e8894a", label: "Apricot" },
  { id: "berry", color: "#c45a78", label: "Berry" },
] as const;

export type ThemeId = (typeof COLOR_THEMES)[number]["id"];

export const COLORS = COLOR_THEMES.map((t) => t.color);

const OLD: Record<string, string> = {
  "#e56b5a": "#e56b5a",
  "#c45c3e": "#e56b5a",
  "#b85c38": "#e56b5a",
  "#8a4a32": "#e56b5a",
  "#8b5e3c": "#e56b5a",
  "#e05a84": "#e05a84",
  "#7a3e5c": "#e05a84",
  "#8b7cc8": "#8b7cc8",
  "#5c6b3a": "#8b7cc8",
  "#4a7fd4": "#4a7fd4",
  "#3d6ea8": "#4a7fd4",
  "#3f5f8a": "#4a7fd4",
  "#4aa3c4": "#4aa3c4",
  "#4a7c8c": "#4aa3c4",
  "#e8894a": "#e8894a",
  "#c9a227": "#e8894a",
  "#a67c52": "#e8894a",
  "#c45a78": "#c45a78",
  "#2f6f5e": "#4aa3c4",
};

export function normalizeColor(color: string | null | undefined) {
  const key = (color || "").toLowerCase();
  if ((COLORS as string[]).includes(key)) return key;
  return OLD[key] ?? COLORS[0];
}

export function themeForColor(color: string | null | undefined) {
  const hex = normalizeColor(color);
  return COLOR_THEMES.find((t) => t.color === hex) ?? COLOR_THEMES[0];
}

export function applyColorTheme(color: string | null | undefined) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", themeForColor(color).id);
}
