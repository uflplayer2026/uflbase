import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Called every 15 minutes by the backend scheduler (pg_cron). Requires the cron secret. */
export const Route = createFileRoute("/api/public/drive-sync-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateCronRequest(request);
        if (unauthorized) return unauthorized;

        const { syncDrive } = await import("@/lib/drive.server");
        const result = await syncDrive("auto");
        return Response.json(
          { status: result.status, message: result.message },
          { status: result.status === "failed" ? 502 : 200 },
        );
      },
    },
  },
});
