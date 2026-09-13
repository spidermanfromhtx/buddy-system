import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { sendMailMx } from "@/lib/smtp.server";

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

export async function sendCodeEmail(to: string, code: string, kind: "account" | "campus") {
  const what = kind === "campus" ? "campus code" : "login code";
  const text = `Your Buddy System ${what} is ${code}.\n\nIt expires in 10 minutes.\n\nIf you did not ask for this, ignore the email.`;
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Buddy System <noreply@resend.dev>",
        to,
        subject: `Your Buddy System ${what}`,
        text,
      }),
    });
    if (!res.ok) throw new Error("email failed");
    return;
  }
  await sendMailMx(to, `Your Buddy System ${what}`, text);
}
