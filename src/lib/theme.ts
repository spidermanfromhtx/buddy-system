export const NONE = "";
export const HOUSE = "#ff6b81";
export const HOUSE_INK = "#0f3a44";
export const HOUSE_CREAM = "#e8e1d8";

export const COLOR_THEMES = [
  { id: "red", color: "#c44536", label: "Red" },
  { id: "orange", color: "#c45c2e", label: "Orange" },
  { id: "yellow", color: "#e09b2d", label: "Yellow" },
  { id: "green", color: "#1a4a3a", label: "Green" },
  { id: "blue", color: "#3aa8ac", label: "Blue" },
  { id: "indigo", color: "#4a2a6e", label: "Indigo" },
  { id: "violet", color: "#c42a72", label: "Violet" },
] as const;

export type ThemeId = (typeof COLOR_THEMES)[number]["id"];

export const COLORS = COLOR_THEMES.map((t) => t.color);

const OLD: Record<string, string> = {
  "#c44536": "#c44536",
  "#c45c2e": "#c45c2e",
  "#e09b2d": "#e09b2d",
  "#1a4a3a": "#1a4a3a",
  "#3aa8ac": "#3aa8ac",
  "#4a2a6e": "#4a2a6e",
  "#c42a72": "#c42a72",
  "#d94b4b": "#c44536",
  "#e07a32": "#c45c2e",
  "#d4b03a": "#e09b2d",
  "#3d9a6a": "#1a4a3a",
  "#3d7ad4": "#3aa8ac",
  "#4a54c8": "#4a2a6e",
  "#8a4cbf": "#c42a72",
  "#e7a6a6": "#c44536",
  "#efc39a": "#c45c2e",
  "#e6d59a": "#e09b2d",
  "#a9d4b8": "#1a4a3a",
  "#a7c6ea": "#3aa8ac",
  "#b4b0e0": "#4a2a6e",
  "#d2b5d8": "#c42a72",
  "#e56b5a": HOUSE,
  "#c45c3e": "#c44536",
  "#e05a84": "#c42a72",
  "#8b7cc8": "#4a2a6e",
  "#4a7fd4": "#3aa8ac",
  "#3d6ea8": "#3aa8ac",
  "#4aa3c4": "#3aa8ac",
  "#e8894a": "#c45c2e",
  "#c9a227": "#e09b2d",
  "#c45a78": "#c42a72",
  "#2f6f5e": "#1a4a3a",
  "#7a3e5c": "#c42a72",
  "#4a7c8c": "#3aa8ac",
  "#5c6b3a": "#1a4a3a",
  "#e8875c": HOUSE,
  "#6b5cff": HOUSE,
  "#c8c4f0": HOUSE,
};

export function normalizeColor(color: string | null | undefined) {
  const key = (color || "").toLowerCase().trim();
  if (!key || key === "default" || key === "none") return NONE;
  if ((COLORS as string[]).includes(key)) return key;
  return OLD[key] ?? NONE;
}

export function applyColorTheme(_color?: string | null) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", "default");
}
