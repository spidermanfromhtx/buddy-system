import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const EMAIL = z.string().max(120);
const TOKEN = z.string().min(16).max(80);
const PHOTO = z.string().max(80000).nullable().optional();

export const requestAccountCode = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ email: EMAIL }).parse(d))
  .handler(async ({ data }) => {
    const { sendAccountCode } = await import("./account.server");
    return sendAccountCode(data);
  });

export const verifyAccountCode = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ email: EMAIL, code: z.string().regex(/^\d{6}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { checkAccountCode } = await import("./account.server");
    return checkAccountCode(data);
  });

export const createAccount = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        email: EMAIL,
        token: TOKEN,
        name: z.string().min(1).max(40),
        birthdate: z.string().max(20),
        color: z.string().max(16),
        photo: PHOTO,
        categories: z.array(z.string()).min(1).max(8),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { createAccount: create } = await import("./account.server");
    return create({ ...data, photo: data.photo ?? null });
  });

export const saveAccount = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        token: TOKEN,
        name: z.string().min(1).max(40).optional(),
        color: z.string().max(16).optional(),
        photo: PHOTO,
        breakEveryMin: z.number().int().min(1).max(60).optional(),
        categories: z.array(z.string()).max(8).optional(),
        limitsOn: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { saveAccount: save } = await import("./account.server");
    return save(data);
  });

export const readAccount = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ token: TOKEN }).parse(d))
  .handler(async ({ data }) => {
    const { readAccount: read } = await import("./account.server");
    return read(data.token);
  });

export const startPlusCheckout = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ token: TOKEN }).parse(d))
  .handler(async ({ data }) => {
    const { startPlusCheckout: start } = await import("./stripe.server");
    return start(data.token);
  });
