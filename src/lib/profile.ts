import { parseCategories } from "./categories";
import { ageFromBirthdate, newId } from "./utils";

const KEY = "buddy-system-profile";

export type Profile = {
  id: string;
  name: string;
  birthdate: string;
  color: string;
  photo: string | null;
  breakEveryMin: number;
  email: string;
  sessionToken: string;
  school: string | null;
  schoolEmail: string | null;
  schoolVerified: boolean;
  campusToken: string | null;
  categories: string[];
  plan: string;
  sessionsUsed: number;
};

export const COLORS = [
  "#c45c3e",
  "#2f6f5e",
  "#3d6ea8",
  "#c9a227",
  "#8b5e3c",
  "#7a3e5c",
  "#4a7c8c",
  "#b85c38",
  "#5c6b3a",
  "#3f5f8a",
  "#a67c52",
  "#8a4a32",
];

export function loadProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Profile>;
    if (!p.id || !p.name || !p.email || !p.sessionToken) return null;
    const birthdate = p.birthdate || "2000-01-01";
    if (p.birthdate && ageFromBirthdate(p.birthdate) < 18) return null;
    return {
      id: p.id,
      name: p.name,
      birthdate,
      photo: p.photo ?? null,
      color: p.color || COLORS[0],
      breakEveryMin: p.breakEveryMin || 30,
      email: p.email,
      sessionToken: p.sessionToken,
      school: p.schoolVerified && p.school ? p.school : null,
      schoolEmail: p.schoolEmail ?? null,
      schoolVerified: Boolean(p.schoolVerified && p.school && p.campusToken),
      campusToken: p.schoolVerified ? p.campusToken ?? null : null,
      categories: parseCategories(p.categories),
      plan: p.plan === "plus" ? "plus" : "free",
      sessionsUsed: Number(p.sessionsUsed ?? 0),
    };
  } catch {
    return null;
  }
}

export function saveProfile(partial: Omit<Profile, "id"> & { id?: string }): Profile {
  const existing = loadProfile();
  const schoolVerified = Boolean(partial.schoolVerified);
  const school = schoolVerified ? partial.school ?? existing?.school ?? null : null;
  const p: Profile = {
    id: partial.id ?? existing?.id ?? newId("p"),
    name: partial.name.trim(),
    birthdate: partial.birthdate,
    color: partial.color,
    photo: partial.photo === undefined ? existing?.photo ?? null : partial.photo,
    breakEveryMin: partial.breakEveryMin,
    email: partial.email.trim().toLowerCase(),
    sessionToken: partial.sessionToken,
    school,
    schoolEmail: schoolVerified ? partial.schoolEmail ?? existing?.schoolEmail ?? null : null,
    schoolVerified: Boolean(schoolVerified && school),
    campusToken: schoolVerified ? partial.campusToken ?? existing?.campusToken ?? null : null,
    categories: parseCategories(partial.categories ?? existing?.categories ?? []),
    plan: partial.plan ?? existing?.plan ?? "free",
    sessionsUsed: partial.sessionsUsed ?? existing?.sessionsUsed ?? 0,
  };
  localStorage.setItem(KEY, JSON.stringify(p));
  return p;
}

export function clearProfile() {
  localStorage.removeItem(KEY);
}

export function profileFromAccount(
  account: {
    id: string;
    email: string;
    name: string;
    birthdate: string;
    color: string;
    photo: string | null;
    breakEveryMin: number;
    sessionToken: string;
    categories?: string[];
    plan?: string;
    sessionsUsed?: number;
  },
  extra?: Partial<Pick<Profile, "school" | "schoolEmail" | "schoolVerified" | "campusToken">>,
): Profile {
  return saveProfile({
    id: account.id,
    name: account.name,
    birthdate: account.birthdate,
    color: account.color,
    photo: account.photo,
    breakEveryMin: account.breakEveryMin,
    email: account.email,
    sessionToken: account.sessionToken,
    school: extra?.school ?? null,
    schoolEmail: extra?.schoolEmail ?? null,
    schoolVerified: extra?.schoolVerified ?? false,
    campusToken: extra?.campusToken ?? null,
    categories: parseCategories(account.categories),
    plan: account.plan ?? "free",
    sessionsUsed: account.sessionsUsed ?? 0,
  });
}
