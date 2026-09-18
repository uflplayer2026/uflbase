import { createFileRoute } from "@tanstack/react-router";

/**
 * Streams a stored asset file. Read-only and public by design: card art has to be
 * visible to every visitor, while the underlying storage bucket stays private.
 */
export const Route = createFileRoute("/api/public/asset/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!path || path.includes("..")) return new Response("Not found", { status: 404 });

        const { readAssetFile } = await import("@/lib/assets.server");
        const file = await readAssetFile(path);
        if (!file) return new Response("Not found", { status: 404 });

        return new Response(file.bytes, {
          headers: {
            "Content-Type": file.mime,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
