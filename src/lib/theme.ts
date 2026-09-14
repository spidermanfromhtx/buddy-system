export const NONE = "";
export const HOUSE = "#6b5cff";
export const HOUSE_INK = "#1c1933";
export const HOUSE_CREAM = "#f5f2ec";

export const COLOR_THEMES = [
  { id: "red", color: "#d94b4b", second: "#f0c35a", third: "#4a7ec8", label: "Red" },
  { id: "orange", color: "#e07a32", second: "#5aa8c8", third: "#c45c86", label: "Orange" },
  { id: "yellow", color: "#d4b03a", second: "#4fa87a", third: "#7a6ad4", label: "Yellow" },
  { id: "green", color: "#3d9a6a", second: "#e0c04a", third: "#6a6ad4", label: "Green" },
  { id: "blue", color: "#3d7ad4", second: "#e07a6a", third: "#e0c04a", label: "Blue" },
  { id: "indigo", color: "#4a54c8", second: "#e07a9a", third: "#50b48c", label: "Indigo" },
  { id: "violet", color: "#8a4cbf", second: "#e0a04a", third: "#4aa0a8", label: "Violet" },
] as const;

export type ThemeId = (typeof COLOR_THEMES)[number]["id"];

export const COLORS = COLOR_THEMES.map((t) => t.color);

const OLD: Record<string, string> = {
  "#e7a6a6": "#d94b4b",
  "#efc39a": "#e07a32",
  "#e6d59a": "#d4b03a",
  "#a9d4b8": "#3d9a6a",
  "#a7c6ea": "#3d7ad4",
  "#b4b0e0": "#4a54c8",
  "#d2b5d8": "#8a4cbf",
  "#e56b5a": "#d94b4b",
  "#c45c3e": "#d94b4b",
  "#e05a84": "#8a4cbf",
  "#8b7cc8": "#4a54c8",
  "#4a7fd4": "#3d7ad4",
  "#3d6ea8": "#3d7ad4",
  "#4aa3c4": "#3d7ad4",
  "#e8894a": "#e07a32",
  "#c9a227": "#d4b03a",
  "#c45a78": "#8a4cbf",
  "#2f6f5e": "#3d9a6a",
  "#7a3e5c": "#8a4cbf",
  "#4a7c8c": "#3d7ad4",
  "#5c6b3a": "#3d9a6a",
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
