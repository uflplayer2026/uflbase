import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PlayerCardRecord } from "./playerTypes";

export type ChangeView = "added" | "updated" | "variants";

export type CardChange = {
  player: PlayerCardRecord;
  at: string | null;
  changedFields: string[];
};

const inputSchema = z.object({
  view: z.enum(["added", "updated", "variants"]),
  hours: z
    .number()
    .int()
    .positive()
    .max(24 * 365),
  limit: z.number().int().positive().max(200).optional(),
});

/**
 * Recently Changed reads only the rows required for the current view, straight
 * from indexed timestamp columns — never the whole database.
 */
export const getRecentChanges = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<CardChange[]> => {
    const { listChanges } = await import("./changes.server");
    return listChanges(data.view, data.hours, data.limit ?? 60);
  });
