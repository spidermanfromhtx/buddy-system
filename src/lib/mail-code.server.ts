import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export function hashCode(email: string, code: string) {
  return createHash("sha256").update(`${email}:${code}`).digest("hex");
}

export function hashesEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function sixDigit() {
  return String(randomInt(100000, 1000000));
}

export function mailErrorMessage(err: unknown) {
  const msg = err instanceof Error ? err.message : "";
  if (msg === "not-configured") return "Email sending is not connected yet.";
  if (msg === "resend-own-email") {
    return "For now, codes only arrive at the email on the Resend account. Use that inbox.";
  }
  return "Could not send the email. Check the address and try again.";
}

export async function sendCodeEmail(to: string, code: string, kind: "account" | "campus") {
  const what = kind === "campus" ? "campus code" : "login code";
  const text = `Your Buddy System ${what} is ${code}.\n\nIt expires in 10 minutes.\n\nIf you did not ask for this, ignore the email.`;
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("not-configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM?.trim() || "Buddy System <beth.t@example.com>",
      to: [to],
      subject: `Your Buddy System ${what}`,
      text,
    }),
  });
  if (res.ok) return;
  const body = await res.text().catch(() => "");
  console.error("resend failed", res.status, body);
  if (res.status === 403 && /own email/i.test(body)) throw new Error("resend-own-email");
  throw new Error("email-failed");
}
