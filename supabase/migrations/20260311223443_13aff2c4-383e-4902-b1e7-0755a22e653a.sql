CREATE TABLE public.face_descriptors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES public.event_photos(id) ON DELETE CASCADE,
  face_index integer NOT NULL DEFAULT 0,
  descriptor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_face_descriptors_event_id ON public.face_descriptors(event_id);
CREATE INDEX idx_face_descriptors_photo_id ON public.face_descriptors(photo_id);

ALTER TABLE public.event_photos ADD COLUMN is_indexed boolean NOT NULL DEFAULT false;

ALTER TABLE public.face_descriptors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view descriptors of active events"
ON public.face_descriptors
FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM public.events
  WHERE events.id = face_descriptors.event_id AND events.is_active = true
));

CREATE POLICY "Admins can manage descriptors"
ON public.face_descriptors
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.events
  WHERE events.id = face_descriptors.event_id AND events.admin_id = auth.uid()
));