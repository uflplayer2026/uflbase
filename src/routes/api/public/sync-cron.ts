import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/sync-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateCronRequest(request);
        if (unauthorized) return unauthorized;

        const { runSync } = await import("@/lib/sheets.server");
        const result = await runSync("auto");
        return Response.json(result, { status: result.status === "failed" ? 502 : 200 });
      },
    },
  },
});
