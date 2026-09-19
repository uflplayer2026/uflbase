-- Asset Manager: Google Drive provenance, import status, composition geometry
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS drive_file_id text,
  ADD COLUMN IF NOT EXISTS drive_folder text,
  ADD COLUMN IF NOT EXISTS drive_modified_at timestamptz,
  ADD COLUMN IF NOT EXISTS import_status text NOT NULL DEFAULT 'IMPORTED',
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS safe_area jsonb,
  ADD COLUMN IF NOT EXISTS protected_areas jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS assets_drive_file_id_key
  ON public.assets (drive_file_id) WHERE drive_file_id IS NOT NULL;

-- Manual background override vs inherited-from-card-type, plus per-card composition override
ALTER TABLE public.card_asset_links
  ADD COLUMN IF NOT EXISTS background_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS composition jsonb;

UPDATE public.card_asset_links
  SET background_manual = true
  WHERE background_asset_id IS NOT NULL;

-- Card types observed in the sheet (column N). Never part of card identity.
CREATE TABLE IF NOT EXISTS public.card_type_registry (
  card_type text PRIMARY KEY,
  card_count integer NOT NULL DEFAULT 0,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.card_type_registry TO service_role;
ALTER TABLE public.card_type_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to card type registry"
  ON public.card_type_registry FOR SELECT TO anon, authenticated USING (false);

-- Administrator-defined CARD TYPE -> CARD BACKGROUND rules
CREATE TABLE IF NOT EXISTS public.card_type_backgrounds (
  card_type text PRIMARY KEY,
  background_asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.card_type_backgrounds TO service_role;
ALTER TABLE public.card_type_backgrounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to card type backgrounds"
  ON public.card_type_backgrounds FOR SELECT TO anon, authenticated USING (false);

-- Google Drive ingestion staging: one row per Drive file, keyed by stable Drive file id
CREATE TABLE IF NOT EXISTS public.drive_assets (
  drive_file_id text PRIMARY KEY,
  name text NOT NULL,
  folder text NOT NULL DEFAULT '',
  asset_type text NOT NULL DEFAULT 'OTHER',
  mime_type text NOT NULL DEFAULT '',
  file_size bigint,
  drive_modified_at timestamptz,
  status text NOT NULL DEFAULT 'DETECTED',
  error text,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  match_group text,
  matched_variant_key text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS drive_assets_status_idx ON public.drive_assets (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS drive_assets_type_idx ON public.drive_assets (asset_type, updated_at DESC);
GRANT ALL ON public.drive_assets TO service_role;
ALTER TABLE public.drive_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to drive assets"
  ON public.drive_assets FOR SELECT TO anon, authenticated USING (false);

-- Drive synchronization settings and status
CREATE TABLE IF NOT EXISTS public.drive_sync_state (
  id text PRIMARY KEY,
  import_mode text NOT NULL DEFAULT 'manual',
  root_folder_id text,
  last_sync_at timestamptz,
  last_status text,
  last_error text,
  counters jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_running boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.drive_sync_state (id) VALUES ('drive') ON CONFLICT (id) DO NOTHING;
GRANT ALL ON public.drive_sync_state TO service_role;
ALTER TABLE public.drive_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to drive sync state"
  ON public.drive_sync_state FOR SELECT TO anon, authenticated USING (false);