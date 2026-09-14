import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TOKEN = z.string().min(16).max(80);
const ID = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);

export const leaveReview = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        token: TOKEN,
        subjectId: ID,
        callId: ID.optional(),
        rating: z.number().int().min(1).max(5),
        body: z.string().max(280),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { leaveReview: run } = await import("./trust.server");
    return run(data);
  });

export const leaveAppReview = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        token: TOKEN,
        rating: z.number().int().min(1).max(5),
        body: z.string().min(1).max(280),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { leaveAppReview: run } = await import("./trust.server");
    return run(data);
  });

export const listAppReviews = createServerFn({ method: "GET" }).handler(async () => {
  const { listAppReviews: run } = await import("./trust.server");
  return run();
});

export const ratingsMap = createServerFn({ method: "GET" }).handler(async () => {
  const { ratingsMap: run } = await import("./trust.server");
  return run();
});

export const fileReport = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        token: TOKEN,
        subjectId: ID,
        callId: ID.optional(),
        body: z.string().min(8).max(800),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { fileReport: run } = await import("./trust.server");
    return run(data);
  });
