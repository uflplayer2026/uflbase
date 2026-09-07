REVOKE EXECUTE ON FUNCTION public.acquire_sync_lock(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_sync_lock(INTEGER) TO service_role;