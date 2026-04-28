-- Ejecutar en Supabase SQL Editor

CREATE TABLE preroll_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  video_url TEXT NOT NULL,
  duracion INTEGER DEFAULT 15,
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE preroll_videos DISABLE ROW LEVEL SECURITY;
