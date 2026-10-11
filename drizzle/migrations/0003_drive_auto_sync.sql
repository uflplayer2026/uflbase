CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
ALTER TABLE public.drive_sync_state
  ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_trigger text,
  ADD COLUMN IF NOT EXISTS last_error_kind text,
  ADD COLUMN IF NOT EXISTS last_scheduler_run_at timestamptz;
ALTER TABLE public.drive_assets
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz;

CREATE OR REPLACE FUNCTION public.acquire_drive_sync_lock(_stale_seconds integer DEFAULT 600)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE acquired integer;
BEGIN
  UPDATE public.drive_sync_state
  SET sync_running = true, sync_started_at = now(), updated_at = now()
  WHERE id = 'drive'
    AND (sync_running = false OR sync_started_at IS NULL
         OR sync_started_at < now() - make_interval(secs => _stale_seconds));
  GET DIAGNOSTICS acquired = ROW_COUNT;
  RETURN acquired > 0;
END; $$;
REVOKE ALL ON FUNCTION public.acquire_drive_sync_lock(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_drive_sync_lock(integer) TO service_role;