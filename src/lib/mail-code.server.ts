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
  if (msg === "resend-own-email" || msg === "resend-domain") {
    return "That inbox cannot get a code until we connect a mail sender that can reach everyone.";
  }
  return "Could not send the email. Check the address and try again.";
}

export async function sendMail(to: string, subject: string, text: string) {
  const brevo = process.env.BREVO_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (brevo && from) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevo,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Buddy System", email: from },
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });
    if (res.ok) return;
    const body = await res.text().catch(() => "");
    console.error("brevo failed", res.status, body);
    throw new Error("email-failed");
  }

  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("not-configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: from || "Buddy System <beth.t@example.com>",
      to: [to],
      subject,
      text,
    }),
  });
  if (res.ok) return;
  const body = await res.text().catch(() => "");
  console.error("resend failed", res.status, body);
  if (/own email/i.test(body)) throw new Error("resend-own-email");
  if (/not verified|verify your domain|resend\.dev/i.test(body)) throw new Error("resend-domain");
  throw new Error("email-failed");
}

export async function sendCodeEmail(to: string, code: string, kind: "account" | "campus") {
  const what = kind === "campus" ? "campus code" : "login code";
  await sendMail(
    to,
    `Your Buddy System ${what}`,
    `Your Buddy System ${what} is ${code}.\n\nIt expires in 10 minutes.\n\nIf you did not ask for this, ignore the email.`,
  );
}
