import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CHANGELOG_CATEGORIES = ["New", "Improved", "Fixed", "Performance"] as const;
export type ChangelogCategory = (typeof CHANGELOG_CATEGORIES)[number];

export type ChangelogEntry = {
  id: string;
  version: string;
  entryDate: string;
  title: string;
  description: string;
  categories: Partial<Record<ChangelogCategory, string[]>>;
};

const entrySchema = z.object({
  id: z.string().uuid().optional(),
  version: z.string().trim().min(1).max(40),
  entryDate: z.string().trim().min(1).max(20),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).default(""),
  categories: z.record(z.enum(CHANGELOG_CATEGORIES), z.array(z.string().trim().min(1).max(300))),
});

type Row = {
  id: string;
  version: string;
  entry_date: string;
  title: string;
  description: string;
  categories: unknown;
};

function toEntry(row: Row): ChangelogEntry {
  const categories: Partial<Record<ChangelogCategory, string[]>> = {};
  const raw = (row.categories ?? {}) as Record<string, unknown>;
  for (const key of CHANGELOG_CATEGORIES) {
    const value = raw[key];
    if (Array.isArray(value)) {
      const items = value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
      if (items.length > 0) categories[key] = items;
    }
  }
  return {
    id: row.id,
    version: row.version,
    entryDate: row.entry_date,
    title: row.title,
    description: row.description ?? "",
    categories,
  };
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Public read — no authentication required. */
export const listChangelog = createServerFn({ method: "GET" }).handler(
  async (): Promise<ChangelogEntry[]> => {
    const client = await db();
    const { data, error } = await client
      .from("changelog_entries")
      .select("id, version, entry_date, title, description, categories")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[]).map(toEntry);
  },
);

export const saveChangelogEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entrySchema.parse(data))
  .handler(async ({ data, context }): Promise<ChangelogEntry> => {
    const { assertAdmin } = await import("./adminAuth.server");
    assertAdmin(context.claims);
    const client = await db();
    const payload = {
      version: data.version,
      entry_date: data.entryDate,
      title: data.title,
      description: data.description,
      categories: data.categories,
      updated_at: new Date().toISOString(),
    };
    const query = data.id
      ? client.from("changelog_entries").update(payload).eq("id", data.id)
      : client.from("changelog_entries").insert(payload);
    const { data: row, error } = await query
      .select("id, version, entry_date, title, description, categories")
      .single();
    if (error) throw new Error(error.message);
    return toEntry(row as Row);
  });

export const deleteChangelogEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { assertAdmin } = await import("./adminAuth.server");
    assertAdmin(context.claims);
    const client = await db();
    const { error } = await client.from("changelog_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
