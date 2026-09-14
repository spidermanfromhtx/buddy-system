export const NONE = "";
export const HOUSE = "#6b5cff";
export const HOUSE_INK = "#1c1933";
export const HOUSE_CREAM = "#f5f2ec";

/** ROYGBIV primaries. Each is a 3-color set from the chart (Poppy, Paprika, Honey, Cedar, Lagoon, Aubergine, Fuchsia). */
export const COLOR_THEMES = [
  { id: "red", color: "#c44536", second: "#2f4a4c", third: "#e08a3c", label: "Red" },
  { id: "orange", color: "#c45c2e", second: "#e8d5c4", third: "#3d2418", label: "Orange" },
  { id: "yellow", color: "#e09b2d", second: "#d4c4b0", third: "#6b6a68", label: "Yellow" },
  { id: "green", color: "#1a4a3a", second: "#c5d63a", third: "#eee6d8", label: "Green" },
  { id: "blue", color: "#3aa8ac", second: "#e08a3c", third: "#e56b62", label: "Blue" },
  { id: "indigo", color: "#4a2a6e", second: "#eee6d8", third: "#2a8a8a", label: "Indigo" },
  { id: "violet", color: "#c42a72", second: "#eee6d8", third: "#6a5a8a", label: "Violet" },
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
  "#e56b5a": "#c44536",
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
};

export function normalizeColor(color: string | null | undefined) {
  const key = (color || "").toLowerCase().trim();
  if (!key || key === "default" || key === "none") return NONE;
  if ((COLORS as string[]).includes(key)) return key;
  return OLD[key] ?? NONE;
}

export function themeForColor(color: string | null | undefined) {
  const hex = normalizeColor(color);
  if (!hex) return { id: "default" as const, color: NONE, second: HOUSE_INK, third: HOUSE_CREAM, label: "Default" };
  return (
    COLOR_THEMES.find((t) => t.color === hex) ?? {
      id: "default" as const,
      color: NONE,
      second: HOUSE_INK,
      third: HOUSE_CREAM,
      label: "Default",
    }
  );
}

export function swatchFill(color: string | null | undefined) {
  const t = themeForColor(color);
  const a = t.color || HOUSE;
  return `conic-gradient(from 210deg, ${a} 0 40%, ${t.second} 40% 70%, ${t.third} 70% 100%)`;
}

export function applyColorTheme(color: string | null | undefined) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", themeForColor(color).id);
}
