import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CardTypeBackground, CardTypeEntry } from "./cardTypes.server";

export type { CardTypeBackground, CardTypeEntry } from "./cardTypes.server";

async function guard(claims: unknown) {
  const { assertAdmin } = await import("./adminAuth.server");
  return assertAdmin(claims);
}

/** Public read: every visitor needs the card type -> background rules to render cards. */
export const getCardTypeBackgrounds = createServerFn({ method: "GET" }).handler(
  async (): Promise<CardTypeBackground[]> => {
    const { listCardTypeBackgrounds } = await import("./cardTypes.server");
    return listCardTypeBackgrounds();
  },
);

export const getCardTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CardTypeEntry[]> => {
    await guard(context.claims);
    const { listCardTypes } = await import("./cardTypes.server");
    return listCardTypes();
  });

export const assignCardTypeBackground = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        cardType: z.string().min(1).max(200),
        assetId: z.string().uuid().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await guard(context.claims);
    const { saveCardTypeBackground } = await import("./cardTypes.server");
    await saveCardTypeBackground(data.cardType, data.assetId);
    return { ok: true };
  });

export const removeCardTypeMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ cardType: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await guard(context.claims);
    const { deleteCardTypeBackground } = await import("./cardTypes.server");
    await deleteCardTypeBackground(data.cardType);
    return { ok: true };
  });
