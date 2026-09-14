import { getRequest } from "@tanstack/react-start/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";
import { markFreeByCustomer, markPlus, markPlusByCustomer } from "@/lib/plan.server";

function stripeKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || "";
}

function originFromRequest() {
  const req = getRequest();
  const url = req ? new URL(req.url) : null;
  const proto = req?.headers.get("x-forwarded-proto") || url?.protocol.replace(":", "") || "https";
  const host = req?.headers.get("x-forwarded-host") || req?.headers.get("host") || url?.host || "";
  return `${proto}://${host}`;
}

async function stripeForm(path: string, body: Record<string, string>) {
  const key = stripeKey();
  if (!key) throw new Error("not-configured");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    console.error("stripe failed", path, json);
    throw new Error("stripe-failed");
  }
  return json;
}

export async function startPlusCheckout(token: string) {
  const sql = await getSql();
  const rows = await sql.query(`SELECT * FROM accounts WHERE session_token = $1 LIMIT 1`, [token]);
  const row = rows[0];
  if (!row) return { ok: false as const, error: "Sign in again." };
  if (String(row.plan) === "plus") return { ok: false as const, error: "You already have Plus." };
  if (!stripeKey()) {
    return { ok: false as const, error: "Payments are not connected yet." };
  }
  const origin = originFromRequest();
  const session = await stripeForm("checkout/sessions", {
    mode: "subscription",
    success_url: `${origin}/feed?plus=1`,
    cancel_url: `${origin}/feed?plus=0`,
    client_reference_id: String(row.id),
    customer_email: String(row.email),
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": "500",
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": "Buddy System Plus",
    "line_items[0][price_data][product_data][description]": "Unlimited sessions. Calls longer than 45 minutes.",
    "metadata[account_id]": String(row.id),
    "subscription_data[metadata][account_id]": String(row.id),
  });
  const url = typeof session.url === "string" ? session.url : "";
  if (!url) return { ok: false as const, error: "Could not start checkout." };
  return { ok: true as const, url };
}

export async function handleStripeWebhook(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const payload = await request.text();
  if (secret) {
    const sig = request.headers.get("stripe-signature") || "";
    if (!verifyStripeSig(payload, sig, secret)) {
      return new Response("bad signature", { status: 400 });
    }
  }
  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload) as typeof event;
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const obj = event.data?.object ?? {};
  const type = event.type || "";
  if (type === "checkout.session.completed") {
    const accountId = String(obj.client_reference_id || (obj.metadata as Record<string, string> | undefined)?.account_id || "");
    const customer = String(obj.customer || "");
    const sub = String(obj.subscription || "");
    if (accountId && customer) await markPlus(accountId, customer, sub);
  }
  if (type === "customer.subscription.deleted") {
    const customer = String(obj.customer || "");
    if (customer) await markFreeByCustomer(customer);
  }
  if (type === "customer.subscription.updated") {
    const customer = String(obj.customer || "");
    const sub = String(obj.id || "");
    const status = String(obj.status || "");
    if (customer && (status === "active" || status === "trialing")) await markPlusByCustomer(customer, sub);
    if (customer && (status === "canceled" || status === "unpaid" || status === "incomplete_expired")) {
      await markFreeByCustomer(customer);
    }
  }
  return new Response("ok");
}

function verifyStripeSig(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(v1, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
