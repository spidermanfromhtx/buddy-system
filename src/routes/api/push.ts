import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/push")({
  server: {
    handlers: {
      GET: async () => {
        const { pushPublicKey } = await import("@/lib/push.server");
        const publicKey = pushPublicKey();
        if (!publicKey) return Response.json({ ok: false }, { status: 503 });
        return Response.json({ publicKey });
      },
      POST: async ({ request }) => {
        const { savePushSub } = await import("@/lib/push.server");
        const body = (await request.json().catch(() => null)) as {
          token?: string;
          subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
        } | null;
        const sub = body?.subscription;
        const result = await savePushSub(String(body?.token || ""), {
          endpoint: String(sub?.endpoint || ""),
          keys: { p256dh: String(sub?.keys?.p256dh || ""), auth: String(sub?.keys?.auth || "") },
        });
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
    },
  },
});
