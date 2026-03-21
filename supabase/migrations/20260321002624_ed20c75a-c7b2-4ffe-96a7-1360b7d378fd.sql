
-- Create face_embeddings table
CREATE TABLE public.face_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES public.event_photos(id) ON DELETE CASCADE,
  face_index integer NOT NULL DEFAULT 0,
  embedding vector(32) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(photo_id, face_index)
);

-- Indexes
CREATE INDEX face_embeddings_event_idx ON public.face_embeddings(event_id);
CREATE INDEX face_embeddings_embedding_idx ON public.face_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- RLS
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to embeddings" ON public.face_embeddings
  FOR ALL TO service_role USING (true);

CREATE POLICY "Admins can manage embeddings" ON public.face_embeddings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM events WHERE events.id = face_embeddings.event_id AND events.admin_id = auth.uid()));

CREATE POLICY "Anyone can view embeddings of active events" ON public.face_embeddings
  FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM events WHERE events.id = face_embeddings.event_id AND events.is_active = true));

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_face_embeddings(
  query_embedding vector(32),
  match_event_id uuid,
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 30
)
RETURNS TABLE (photo_id uuid, face_index int, similarity float)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fe.photo_id,
    fe.face_index,
    (1 - (fe.embedding <=> query_embedding))::float as similarity
  FROM public.face_embeddings fe
  WHERE fe.event_id = match_event_id
    AND 1 - (fe.embedding <=> query_embedding) > match_threshold
  ORDER BY fe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
