const PERSONAL = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "hey.com",
  "mail.com",
]);

export function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export function isEmail(raw: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(raw));
}

export function isAcademicDomain(domain: string) {
  const d = domain.toLowerCase();
  return (
    d.endsWith(".edu") ||
    d.includes(".edu.") ||
    d.endsWith(".ac.uk") ||
    /\.ac\.[a-z]{2}$/.test(d) ||
    d.endsWith(".edu.au") ||
    d.endsWith(".edu.sg")
  );
}

/** Verified campus domain only. Personal and non-school inboxes return null. */
export function schoolFromEmail(raw: string) {
  const email = normalizeEmail(raw);
  if (!isEmail(email)) return null;
  const domain = email.split("@")[1] ?? "";
  if (!domain || PERSONAL.has(domain) || !isAcademicDomain(domain)) return null;
  return domain;
}
