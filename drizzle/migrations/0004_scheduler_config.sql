CREATE TABLE IF NOT EXISTS public.scheduler_config (key text PRIMARY KEY, value text NOT NULL);
REVOKE ALL ON public.scheduler_config FROM anon, authenticated;
GRANT ALL ON public.scheduler_config TO service_role;
ALTER TABLE public.scheduler_config ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.scheduler_config IS 'Server-only scheduler settings; no client access.';