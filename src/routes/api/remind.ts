import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/remind")({
  server: {
    handlers: {
      GET: async () => {
        const { sendDueReminders } = await import("@/lib/push.server");
        return sendDueReminders();
      },
    },
  },
});
