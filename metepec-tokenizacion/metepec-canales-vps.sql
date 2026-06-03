-- ============================================================
-- METEPEC FUNCIONA TV — Tokenización VPS + Canales BAIT/TU TV
-- Ejecutar en Supabase de Metepec (wwoifdrnllhxptmbkxvp)
-- SQL Editor → New Query → Run
-- ============================================================

-- 1. Tabla de log de accesos a streams (para la Edge Function)
CREATE TABLE IF NOT EXISTS stream_access_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID,
  canal TEXT,
  ip_address TEXT,
  token_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE stream_access_log DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. CANALES — Limpiar e importar los de BAIT TV / TU TV
-- ============================================================

-- Borrar los 4 canales municipales de prueba (opcional, descomenta si quieres reemplazarlos)
-- DELETE FROM canales;

-- Canales base abiertos (mdstrm - NO requieren token)
INSERT INTO canales (nombre, slug, url_hls, logo_url, categoria, orden, activo) VALUES
('Azteca 1', 'azteca1', 'https://mdstrm.com/live-stream-playlist/574463697b9817cf0886fc17.m3u8', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Azteca_Uno_2022.svg/200px-Azteca_Uno_2022.svg.png', 'Entretenimiento', 10, true),
('Azteca 7', 'azteca7', 'https://mdstrm.com/live-stream-playlist/5a39781f734e53084a901dba.m3u8', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Azteca_7_2022.svg/200px-Azteca_7_2022.svg.png', 'Entretenimiento', 11, true),
('ADN 40', 'adn40', 'https://mdstrm.com/live-stream-playlist/574463697b9817cf0886fc17.m3u8', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/ADN_40_logo_2020.svg/200px-ADN_40_logo_2020.svg.png', 'Noticias', 12, true),
('Multimedios', 'multimedios', 'https://mdstrm.com/live-stream-playlist/57a498c4d7b86d600e5461cb.m3u8', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Multimedios_Televisi%C3%B3n_2018.svg/200px-Multimedios_Televisi%C3%B3n_2018.svg.png', 'Entretenimiento', 13, true),
('Nu9ve', 'nu9ve', 'https://channel09.akamaized.net/hls/live/2093191/event01/index.m3u8', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Nu9ve_logo_2016.svg/200px-Nu9ve_logo_2016.svg.png', 'Entretenimiento', 14, true);

-- ============================================================
-- 3. CANALES DEL VPS CACHE (requieren token - se reproducen vía cache.sharkbroadcast.com)
-- IMPORTANTE: La URL debe apuntar al cache o b-cdn para que getStreamName
-- active la tokenización. Formato: /hls/{nombre_stream}/index.m3u8 o /hls/{stream}.m3u8
-- ============================================================

-- Ejemplo (Canal 1 / bitt channels). Ajusta los nombres de stream reales:
INSERT INTO canales (nombre, slug, url_hls, logo_url, categoria, orden, activo) VALUES
('Canal 1', 'canal1', 'https://cache.sharkbroadcast.com/hls/main.m3u8', '/logos/canal1.png', 'General', 20, true);

-- Para agregar más canales del VPS, usa este formato:
-- INSERT INTO canales (nombre, slug, url_hls, categoria, orden, activo) VALUES
-- ('Nombre Canal', 'slug-canal', 'https://cache.sharkbroadcast.com/hls/NOMBRE_STREAM/index.m3u8', 'Categoria', 21, true);

-- ============================================================
-- LISTO. Verifica en Table Editor que los canales aparezcan.
-- Los canales con cache.sharkbroadcast.com usarán token automáticamente.
-- ============================================================
