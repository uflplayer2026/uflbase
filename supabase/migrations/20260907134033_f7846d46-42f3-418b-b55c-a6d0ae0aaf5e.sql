CREATE TABLE public.sheet_sync_state (
  id TEXT PRIMARY KEY,
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  card_count INTEGER NOT NULL DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  last_duration_ms INTEGER,
  last_status TEXT,
  last_error TEXT,
  sync_running BOOLEAN NOT NULL DEFAULT false,
  sync_started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.sheet_sync_state TO service_role;

ALTER TABLE public.sheet_sync_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.sheet_sync_state (id) VALUES ('players');

CREATE OR REPLACE FUNCTION public.acquire_sync_lock(_stale_seconds INTEGER DEFAULT 300)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acquired BOOLEAN;
BEGIN
  UPDATE public.sheet_sync_state
  SET sync_running = true,
      sync_started_at = now(),
      last_attempt_at = now(),
      updated_at = now()
  WHERE id = 'players'
    AND (
      sync_running = false
      OR sync_started_at IS NULL
      OR sync_started_at < now() - make_interval(secs => _stale_seconds)
    );
  GET DIAGNOSTICS acquired = ROW_COUNT;
  RETURN acquired;
END;
$$;