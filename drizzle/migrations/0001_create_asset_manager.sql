CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'OTHER',
  source TEXT NOT NULL DEFAULT 'upload',
  url TEXT NOT NULL,
  storage_path TEXT,
  mime_type TEXT NOT NULL DEFAULT '',
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX assets_type_created_idx ON public.assets (asset_type, created_at DESC);
CREATE INDEX assets_name_idx ON public.assets (lower(name));

GRANT SELECT ON public.assets TO anon;
GRANT SELECT ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assets are publicly readable"
  ON public.assets FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE public.card_asset_links (
  variant_key TEXT PRIMARY KEY,
  card_image_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  background_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX card_asset_links_card_image_idx ON public.card_asset_links (card_image_asset_id);
CREATE INDEX card_asset_links_background_idx ON public.card_asset_links (background_asset_id);

GRANT SELECT ON public.card_asset_links TO anon;
GRANT SELECT ON public.card_asset_links TO authenticated;
GRANT ALL ON public.card_asset_links TO service_role;

ALTER TABLE public.card_asset_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Card asset links are publicly readable"
  ON public.card_asset_links FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read asset files"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'assets');