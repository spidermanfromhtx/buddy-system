export const COLOR_THEMES = [
  { id: "clay", color: "#c45c3e", label: "Clay" },
  { id: "sage", color: "#2f6f5e", label: "Sage" },
  { id: "sea", color: "#3d6ea8", label: "Sea" },
  { id: "gold", color: "#c9a227", label: "Gold" },
  { id: "plum", color: "#7a3e5c", label: "Plum" },
  { id: "slate", color: "#4a7c8c", label: "Slate" },
  { id: "moss", color: "#5c6b3a", label: "Moss" },
] as const;

export type ThemeId = (typeof COLOR_THEMES)[number]["id"];

export const COLORS = COLOR_THEMES.map((t) => t.color);

const OLD: Record<string, string> = {
  "#c45c3e": "#c45c3e",
  "#b85c38": "#c45c3e",
  "#8a4a32": "#c45c3e",
  "#8b5e3c": "#c45c3e",
  "#a67c52": "#c9a227",
  "#2f6f5e": "#2f6f5e",
  "#3d6ea8": "#3d6ea8",
  "#3f5f8a": "#3d6ea8",
  "#c9a227": "#c9a227",
  "#7a3e5c": "#7a3e5c",
  "#4a7c8c": "#4a7c8c",
  "#5c6b3a": "#5c6b3a",
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
