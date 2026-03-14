-- 1. Unique constraint on face_descriptors (photo_id, face_index) to prevent duplicates
ALTER TABLE public.face_descriptors 
ADD CONSTRAINT face_descriptors_photo_id_face_index_unique UNIQUE (photo_id, face_index);

-- 2. Create a search_rate_limits table for server-side rate limiting
CREATE TABLE public.search_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  client_ip text NOT NULL,
  search_count integer NOT NULL DEFAULT 1,
  first_search_at timestamp with time zone NOT NULL DEFAULT now(),
  last_search_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, client_ip)
);

ALTER TABLE public.search_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow edge functions (service role) full access, no public access needed
CREATE POLICY "Service role only" ON public.search_rate_limits
  FOR ALL TO service_role USING (true);

-- 3. Function to clean old search_requests (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_search_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.search_requests
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;