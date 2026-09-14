import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { listingsSimilar, prefsFit, sid } from "@/lib/match";
import { takeSession } from "@/lib/plan.server";

const ID = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);

const PHOTO = z.string().max(80000).optional();

async function schoolForPeer(sql: Sql, peerId: string) {
  const rows = await sql.query(`SELECT school FROM campus_members WHERE peer_id = $1 LIMIT 1`, [peerId]);
  return rows[0]?.school ? String(rows[0].school) : null;
}

export type Listing = {
  id: string;
  peerId: string;
  name: string;
  color: string;
  photo: string | null;
  task: string;
  urgent: boolean;
  mode: "live" | "scheduled";
  lengthMin: number;
  camera: boolean;
  similarPref: string;
  windowLabel: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  dueDate: string | null;
  expiresAt: string | null;
  school: string | null;
  matchId: string | null;
  matchPeerId: string | null;
  matchPeerName: string | null;
  matchRoom: string | null;
  matchCallId: string | null;
  category: string | null;
  ratingAvg: number | null;
  ratingCount: number;
};

function mapRow(r: Record<string, unknown>): Listing {
  return {
    id: String(r.id),
    peerId: String(r.peer_id),
    name: String(r.name),
    color: String(r.color),
    photo: r.photo ? String(r.photo) : null,
    task: String(r.task),
    urgent: Boolean(r.urgent),
    mode: r.mode === "scheduled" ? "scheduled" : "live",
    lengthMin: Number(r.length_min ?? 25),
    camera: Boolean(r.camera),
    similarPref: String(r.similar_pref ?? "either"),
    windowLabel: r.window_label ? String(r.window_label) : null,
    windowStart: r.window_start ? String(r.window_start) : null,
    windowEnd: r.window_end ? String(r.window_end) : null,
    dueDate: r.due_date ? String(r.due_date) : null,
    expiresAt: r.expires_at ? String(r.expires_at) : null,
    school: r.school ? String(r.school) : null,
    matchId: r.match_id ? String(r.match_id) : null,
    matchPeerId: r.match_peer_id ? String(r.match_peer_id) : null,
    matchPeerName: r.match_peer_name ? String(r.match_peer_name) : null,
    matchRoom: r.match_room ? String(r.match_room) : null,
    matchCallId: r.match_call_id ? String(r.match_call_id) : null,
    category: r.category ? String(r.category) : null,
    ratingAvg: r.rating_avg != null ? Number(r.rating_avg) : null,
    ratingCount: r.rating_n != null ? Number(r.rating_n) : 0,
  };
}

export const listOpen = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z
      .object({
        tab: z.enum(["all", "school"]).optional(),
        peerId: ID.optional(),
        token: z.string().max(128).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }): Promise<Listing[]> => {
    try {
      const sql = await getSql();
      await activateDueMatches(sql);
      if (data.tab === "school") {
        if (!data.peerId || !data.token) return [];
        const member = await sql.query(
          `SELECT school FROM campus_members WHERE peer_id = $1 AND token = $2 LIMIT 1`,
          [data.peerId, data.token],
        );
        const school = member[0]?.school ? String(member[0].school) : null;
        if (!school) return [];
        const rows = await sql.query(
          `SELECT l.*, s.avg as rating_avg, s.n as rating_n
           FROM listings l
           LEFT JOIN (
             SELECT subject_id, avg(rating)::float as avg, count(*)::int as n FROM reviews GROUP BY subject_id
           ) s ON s.subject_id = l.peer_id
           WHERE school = $1
             AND (expires_at IS NULL OR expires_at > now())
             AND peer_id NOT LIKE 'dummy-%'
             AND peer_id NOT IN (SELECT id FROM accounts WHERE banned = true)
           ORDER BY urgent DESC, created_at DESC
           LIMIT 80`,
          [school],
        );
        return rows.map(mapRow);
      }
      const rows = await sql.query(
        `SELECT l.*, s.avg as rating_avg, s.n as rating_n
         FROM listings l
         LEFT JOIN (
           SELECT subject_id, avg(rating)::float as avg, count(*)::int as n FROM reviews GROUP BY subject_id
         ) s ON s.subject_id = l.peer_id
         WHERE (school IS NULL OR school = '')
           AND (expires_at IS NULL OR expires_at > now())
           AND peer_id NOT LIKE 'dummy-%'
           AND peer_id NOT IN (SELECT id FROM accounts WHERE banned = true)
         ORDER BY urgent DESC, created_at DESC
         LIMIT 80`,
      );
      return rows.map(mapRow);
    } catch {
      return [];
    }
  });

export const upsertLive = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        id: ID,
        peerId: ID,
        name: z.string().min(1).max(40),
        color: z.string().max(16),
        photo: PHOTO,
        task: z.string().min(1).max(80),
        urgent: z.boolean(),
        lengthMin: z.number().int().min(5).max(120),
        camera: z.boolean(),
        dueDate: z.string().max(20).optional(),
        school: z.string().max(80).optional(),
        category: z.string().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const school = await schoolForPeer(sql, data.peerId);
    const existing = await sql.query(
      `SELECT id FROM listings WHERE peer_id = $1 AND mode = 'live' LIMIT 1`,
      [data.peerId],
    );
    if (!existing[0]) {
      const gate = await takeSession(sql, data.peerId, data.lengthMin);
      if (!gate.ok) return gate;
    }
    await sql.query(
      `INSERT INTO listings (id, peer_id, name, color, photo, task, urgent, mode, length_min, camera, due_date, school, category, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'live',$8,$9,$10,$11,$12, now() + interval '15 minutes')
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         color = EXCLUDED.color,
         photo = EXCLUDED.photo,
         task = EXCLUDED.task,
         urgent = EXCLUDED.urgent,
         length_min = EXCLUDED.length_min,
         camera = EXCLUDED.camera,
         due_date = EXCLUDED.due_date,
         school = EXCLUDED.school,
         category = EXCLUDED.category,
         expires_at = now() + interval '15 minutes'`,
      [
        data.id,
        data.peerId,
        data.name,
        data.color,
        data.photo ?? null,
        data.task,
        data.urgent,
        data.lengthMin,
        data.camera,
        data.dueDate ?? null,
        school,
        data.category ?? null,
      ],
    );
    return { ok: true as const, usedSession: !existing[0] };
  });

export const bookWindow = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        id: ID,
        peerId: ID,
        name: z.string().min(1).max(40),
        color: z.string().max(16),
        photo: PHOTO,
        task: z.string().min(1).max(80),
        urgent: z.boolean(),
        lengthMin: z.number().int().min(5).max(120),
        camera: z.boolean(),
        similarPref: z.enum(["similar", "different", "either"]),
        windowLabel: z.string().max(80),
        windowStart: z.string().max(40),
        windowEnd: z.string().max(40),
        dueDate: z.string().max(20).optional(),
        school: z.string().max(80).optional(),
        category: z.string().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const school = await schoolForPeer(sql, data.peerId);
    const gate = await takeSession(sql, data.peerId, data.lengthMin);
    if (!gate.ok) return gate;
    await sql.query(
      `INSERT INTO listings
        (id, peer_id, name, color, photo, task, urgent, mode, length_min, camera, similar_pref, window_label, window_start, window_end, due_date, school, category, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled',$8,$9,$10,$11,$12,$13,$14,$15,$16, $13::timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         task = EXCLUDED.task,
         photo = EXCLUDED.photo,
         window_label = EXCLUDED.window_label,
         window_start = EXCLUDED.window_start,
         window_end = EXCLUDED.window_end,
         similar_pref = EXCLUDED.similar_pref,
         school = EXCLUDED.school,
         category = EXCLUDED.category,
         expires_at = EXCLUDED.window_end`,
      [
        data.id,
        data.peerId,
        data.name,
        data.color,
        data.photo ?? null,
        data.task,
        data.urgent,
        data.lengthMin,
        data.camera,
        data.similarPref,
        data.windowLabel,
        data.windowStart,
        data.windowEnd,
        data.dueDate ?? null,
        school,
        data.category ?? null,
      ],
    );
    const matched = await pairListing(sql, data.id);
    return { ok: true as const, matched };
  });

export const stampSchool = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ peerId: ID }).parse(d))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const school = await schoolForPeer(sql, data.peerId);
    await sql.query(`UPDATE listings SET school = $2 WHERE peer_id = $1`, [data.peerId, school]);
    return { ok: true };
  });

export const closeLive = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ peerId: ID }).parse(d))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.query(`DELETE FROM listings WHERE peer_id = $1 AND mode = 'live'`, [data.peerId]);
    return { ok: true };
  });

export type CallRow = {
  id: string;
  room: string;
  callerId: string;
  calleeId: string;
  callerName: string;
  calleeName: string;
  callerColor: string;
  calleeColor: string;
  callerPhoto: string | null;
  calleePhoto: string | null;
  task: string;
  lengthMin: number;
  status: string;
  allowCamera: boolean;
  bothRing: boolean;
};

function mapCall(r: Record<string, unknown>): CallRow {
  return {
    id: String(r.id),
    room: String(r.room),
    callerId: String(r.caller_id),
    calleeId: String(r.callee_id),
    callerName: String(r.caller_name),
    calleeName: String(r.callee_name),
    callerColor: String(r.caller_color ?? "#c45c3e"),
    calleeColor: String(r.callee_color ?? "#2f6f5e"),
    callerPhoto: r.caller_photo ? String(r.caller_photo) : null,
    calleePhoto: r.callee_photo ? String(r.callee_photo) : null,
    task: String(r.task),
    lengthMin: Number(r.length_min ?? 25),
    status: String(r.status),
    allowCamera: Boolean(r.allow_camera),
    bothRing: Boolean(r.both_ring),
  };
}

export const startCall = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        id: ID,
        room: ID,
        callerId: ID,
        calleeId: ID,
        callerName: z.string().max(40),
        calleeName: z.string().max(40),
        callerColor: z.string().max(16),
        calleeColor: z.string().max(16),
        callerPhoto: PHOTO,
        calleePhoto: PHOTO,
        task: z.string().max(80),
        lengthMin: z.number().int().min(5).max(120),
        allowCamera: z.boolean(),
        bothRing: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (data.callerId === data.calleeId) return { ok: false as const };
    const sql = await getSql();
    const gate = await takeSession(sql, data.callerId, data.lengthMin);
    if (!gate.ok) return gate;
    await sql.query(
      `INSERT INTO call_sessions
        (id, room, caller_id, callee_id, caller_name, callee_name, caller_color, callee_color, caller_photo, callee_photo, task, length_min, status, allow_camera, both_ring)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'ringing',$13,$14)`,
      [
        data.id,
        data.room,
        data.callerId,
        data.calleeId,
        data.callerName,
        data.calleeName,
        data.callerColor,
        data.calleeColor,
        data.callerPhoto ?? null,
        data.calleePhoto ?? null,
        data.task,
        data.lengthMin,
        data.allowCamera,
        data.bothRing ?? false,
      ],
    );
    return { ok: true };
  });

export const getCall = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: ID }).parse(d))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query(`SELECT * FROM call_sessions WHERE id = $1 LIMIT 1`, [data.id]);
    return rows[0] ? mapCall(rows[0]) : null;
  });

export const incomingFor = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ peerId: ID }).parse(d))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query(
      `SELECT * FROM call_sessions
       WHERE status = 'ringing' AND (callee_id = $1 OR (caller_id = $1 AND both_ring = true))
       ORDER BY created_at DESC LIMIT 1`,
      [data.peerId],
    );
    return rows[0] ? mapCall(rows[0]) : null;
  });

export const setCallStatus = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        id: ID,
        status: z.enum(["ringing", "live", "done", "declined"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.query(`UPDATE call_sessions SET status = $1 WHERE id = $2`, [data.status, data.id]);
    return { ok: true };
  });

async function pairListing(sql: Sql, listingId: string) {
  const mine = await sql.query(`SELECT * FROM listings WHERE id = $1 LIMIT 1`, [listingId]);
  const row = mine[0];
  if (!row || row.match_id) return null;
  const others = await sql.query(
    `SELECT * FROM listings
     WHERE mode = 'scheduled'
       AND id <> $1
       AND peer_id <> $2
       AND peer_id NOT LIKE 'dummy-%'
       AND match_id IS NULL
       AND (expires_at IS NULL OR expires_at > now())
       AND window_start < $4::timestamptz
       AND window_end > $3::timestamptz
     ORDER BY created_at ASC`,
    [row.id, row.peer_id, row.window_start, row.window_end],
  );
  for (const other of others) {
    const schoolA = row.school ? String(row.school) : "";
    const schoolB = other.school ? String(other.school) : "";
    if (schoolA !== schoolB) continue;
    const similar = listingsSimilar(
      { task: String(row.task), category: row.category ? String(row.category) : null },
      { task: String(other.task), category: other.category ? String(other.category) : null },
    );
    if (!prefsFit(String(row.similar_pref ?? "either"), String(other.similar_pref ?? "either"), similar)) {
      continue;
    }
    const matchId = sid("m");
    const callId = sid("call");
    const room = `r${callId.replace(/-/g, "").slice(0, 20)}`;
    await sql.query(
      `UPDATE listings SET match_id = $1, match_peer_id = $2, match_peer_name = $3, match_room = $4, match_call_id = $5 WHERE id = $6`,
      [matchId, other.peer_id, other.name, room, callId, row.id],
    );
    await sql.query(
      `UPDATE listings SET match_id = $1, match_peer_id = $2, match_peer_name = $3, match_room = $4, match_call_id = $5 WHERE id = $6`,
      [matchId, row.peer_id, row.name, room, callId, other.id],
    );
    const a = { ...row, match_id: matchId, match_peer_id: other.peer_id, match_peer_name: other.name, match_room: room, match_call_id: callId };
    const b = { ...other, match_id: matchId, match_peer_id: row.peer_id, match_peer_name: row.name, match_room: room, match_call_id: callId };
    await ringMatchedIfDue(sql, a, b);
    return { name: String(other.name) };
  }
  return null;
}

async function ringMatchedIfDue(sql: Sql, a: Record<string, unknown>, b: Record<string, unknown>) {
  const callId = String(a.match_call_id ?? "");
  const room = String(a.match_room ?? "");
  if (!callId || !room) return;
  const start = Date.parse(String(a.window_start ?? ""));
  const end = Date.parse(String(a.window_end ?? ""));
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || now < start || now > end) return;
  const existing = await sql.query(`SELECT id, status FROM call_sessions WHERE id = $1 LIMIT 1`, [callId]);
  if (existing[0] && String(existing[0].status) !== "ringing") return;
  if (existing[0]) return;
  const caller = String(a.peer_id) < String(b.peer_id) ? a : b;
  const callee = caller === a ? b : a;
  await sql.query(
    `INSERT INTO call_sessions
      (id, room, caller_id, callee_id, caller_name, callee_name, caller_color, callee_color, caller_photo, callee_photo, task, length_min, status, allow_camera, both_ring)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'ringing',$13,true)`,
    [
      callId,
      room,
      caller.peer_id,
      callee.peer_id,
      caller.name,
      callee.name,
      caller.color ?? "#c45c3e",
      callee.color ?? "#2f6f5e",
      caller.photo ?? null,
      callee.photo ?? null,
      caller.task,
      Number(caller.length_min ?? callee.length_min ?? 25),
      Boolean(caller.camera) || Boolean(callee.camera),
    ],
  );
}

async function activateDueMatches(sql: Sql) {
  const open = await sql.query(
    `SELECT * FROM listings
     WHERE mode = 'scheduled'
       AND match_id IS NULL
       AND window_start <= now()
       AND window_end >= now()`,
  );
  for (const row of open) {
    await pairListing(sql, String(row.id));
  }
  const matched = await sql.query(
    `SELECT * FROM listings
     WHERE mode = 'scheduled'
       AND match_id IS NOT NULL
       AND match_call_id IS NOT NULL
       AND window_start <= now()
       AND window_end >= now()`,
  );
  const seen = new Set<string>();
  for (const row of matched) {
    const callId = String(row.match_call_id);
    if (seen.has(callId)) continue;
    seen.add(callId);
    const partner = matched.find((x) => String(x.id) !== String(row.id) && String(x.match_id) === String(row.match_id));
    if (!partner) continue;
    await ringMatchedIfDue(sql, row, partner);
  }
}
