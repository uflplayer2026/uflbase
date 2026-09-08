CREATE POLICY "No client access to sync state"
ON public.sheet_sync_state FOR SELECT
TO anon, authenticated
USING (false);