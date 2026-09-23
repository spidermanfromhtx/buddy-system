import { getSql } from "@/lib/db";

type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

function vapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || "";
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:spidermanfromtx@icloud.com";
  return { publicKey, privateKey, subject, ok: Boolean(publicKey && privateKey) };
}

export function pushPublicKey() {
  return vapid().publicKey;
}

export async function savePushSub(token: string, sub: PushSub) {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false as const, error: "That browser could not subscribe." };
  }
  const keys = vapid();
  if (!keys.ok) return { ok: false as const, error: "Reminders are not turned on yet." };
  const sql = await getSql();
  const rows = await sql.query(`SELECT id FROM accounts WHERE session_token = $1 LIMIT 1`, [token]);
  const id = rows[0]?.id ? String(rows[0].id) : "";
  if (!id) return { ok: false as const, error: "Sign in again." };
  await sql.query(
    `INSERT INTO push_subs (endpoint, peer_id, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET peer_id = EXCLUDED.peer_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [sub.endpoint, id, sub.keys.p256dh, sub.keys.auth],
  );
  return { ok: true as const };
}

async function webpush() {
  const keys = vapid();
  if (!keys.ok) return null;
  const mod = await import("web-push");
  const wp = mod.default ?? mod;
  wp.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  return wp;
}

export async function sendDueReminders(request: Request) {
  const secret = process.env.REMIND_SECRET?.trim() || "";
  const header = request.headers.get("authorization") || "";
  if (!secret || header !== `Bearer ${secret}`) {
    return new Response("no", { status: 401 });
  }
  const wp = await webpush();
  if (!wp) return Response.json({ ok: false, error: "missing vapid" });
  const sql = await getSql();
  const due = await sql.query(
    `SELECT id, peer_id, task, window_label, match_peer_name
     FROM listings
     WHERE mode = 'scheduled'
       AND reminded_at IS NULL
       AND window_start <= now() + interval '12 minutes'
       AND window_start > now() - interval '3 minutes'
       AND (window_end IS NULL OR window_end > now())`,
  );
  let sent = 0;
  for (const row of due) {
    const who = row.match_peer_name ? ` with ${String(row.match_peer_name)}` : "";
    const when = row.window_label ? ` ${String(row.window_label)}` : "";
    const body = `${String(row.task || "Your booking")}${who} is starting.${when} Open Buddy System.`;
    const subs = await sql.query(`SELECT endpoint, p256dh, auth FROM push_subs WHERE peer_id = $1`, [String(row.peer_id)]);
    for (const sub of subs) {
      try {
        await wp.sendNotification(
          { endpoint: String(sub.endpoint), keys: { p256dh: String(sub.p256dh), auth: String(sub.auth) } },
          JSON.stringify({ title: "Buddy System", body, url: "/feed" }),
        );
        sent += 1;
      } catch (err) {
        const status = typeof err === "object" && err && "statusCode" in err ? Number(err.statusCode) : 0;
        if (status === 404 || status === 410) {
          await sql.query(`DELETE FROM push_subs WHERE endpoint = $1`, [String(sub.endpoint)]);
        }
      }
    }
    await sql.query(`UPDATE listings SET reminded_at = now() WHERE id = $1`, [String(row.id)]);
  }
  return Response.json({ ok: true, checked: due.length, sent });
}
