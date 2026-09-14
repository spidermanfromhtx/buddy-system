import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";

const ID = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);

export const getCallElapsed = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: ID }).parse(d))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ elapsed_sec: number }>(
      `SELECT CASE WHEN status = 'live'
         THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - created_at))))::int
         ELSE 0
       END AS elapsed_sec
       FROM call_sessions
       WHERE id = $1
       LIMIT 1`,
      [data.id],
    );
    return rows[0] ? Number(rows[0].elapsed_sec) : 0;
  });
