import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ID = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const EMAIL = z.string().max(120);

export const requestCampusCode = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ email: EMAIL, peerId: ID }).parse(d))
  .handler(async ({ data }) => {
    const { sendCampusCode } = await import("./campus.server");
    return sendCampusCode(data);
  });

export const verifyCampusCode = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ email: EMAIL, peerId: ID, code: z.string().regex(/^\d{6}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { checkCampusCode } = await import("./campus.server");
    return checkCampusCode(data);
  });
