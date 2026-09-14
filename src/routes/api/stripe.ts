import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleStripeWebhook } = await import("@/lib/stripe.server");
        return handleStripeWebhook(request);
      },
    },
  },
});
