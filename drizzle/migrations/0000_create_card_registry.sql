CREATE TABLE public.card_registry (
  variant_key text PRIMARY KEY,
  row_id text NOT NULL,
  player_name text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  nation text NOT NULL DEFAULT '',
  ovr integer,
  pac integer,
  sho integer,
  pas integer,
  dri integer,
  def integer,
  phy integer,
  perk text NOT NULL DEFAULT '',
  card_image text NOT NULL DEFAULT '',
  fingerprint text NOT NULL,
  is_new_variant boolean NOT NULL DEFAULT false,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_changed_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.card_registry TO anon;
GRANT SELECT ON public.card_registry TO authenticated;
GRANT ALL ON public.card_registry TO service_role;

ALTER TABLE public.card_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Card registry is publicly readable"
  ON public.card_registry FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX card_registry_first_seen_idx ON public.card_registry (first_seen_at DESC);
CREATE INDEX card_registry_last_changed_idx ON public.card_registry (last_changed_at DESC);
CREATE INDEX card_registry_new_variant_idx ON public.card_registry (is_new_variant, first_seen_at DESC);

ALTER TABLE public.sheet_sync_state ADD COLUMN IF NOT EXISTS last_change_count integer NOT NULL DEFAULT 0;