-- Ejecutar en Supabase SQL Editor

CREATE TABLE preroll_canales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  preroll_id UUID REFERENCES preroll_videos(id) ON DELETE CASCADE,
  canal_id UUID REFERENCES canales(id) ON DELETE CASCADE,
  activo BOOLEAN DEFAULT true,
  UNIQUE(preroll_id, canal_id)
);

ALTER TABLE preroll_canales DISABLE ROW LEVEL SECURITY;
