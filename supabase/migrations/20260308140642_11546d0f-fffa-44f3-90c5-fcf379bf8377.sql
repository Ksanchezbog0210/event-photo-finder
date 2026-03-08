
-- Fix overly permissive INSERT policies by adding basic validation
DROP POLICY "Anyone can create search requests" ON public.search_requests;
CREATE POLICY "Anyone can create search requests"
  ON public.search_requests FOR INSERT
  WITH CHECK (event_id IS NOT NULL);

DROP POLICY "Anyone can create purchase requests" ON public.purchase_requests;
CREATE POLICY "Anyone can create purchase requests"
  ON public.purchase_requests FOR INSERT
  WITH CHECK (event_id IS NOT NULL AND array_length(photo_ids, 1) > 0);
