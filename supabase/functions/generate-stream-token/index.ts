import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto as stdCrypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const STREAM_SECRET = Deno.env.get("STREAM_SECRET") || "SharkStream2026Secret";
const CACHE_DOMAIN  = "https://cache.sharkbroadcast.com";
const TOKEN_TTL     = 3600;

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function base64url(bytes: Uint8Array): string {
  return base64Encode(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function md5Binary(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const hash = await stdCrypto.subtle.digest("MD5", data);
  return new Uint8Array(hash);
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "0.0.0.0"
  );
}

const ALLOWED_ORIGINS = [
  "https://metepec-funciona-tv.com",
  "https://www.metepec-funciona-tv.com",
  "https://metepec-funciona-tv.vercel.app",
  "https://tv.metepec-wifi.lat",
  "http://localhost:5173",
  "http://localhost:5174",
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-session-token",
    "Access-Control-Max-Age": "86400",
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método no permitido" }),
      { status: 405, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { usuario_id, session_token, canal, uri } = body;

    if (!usuario_id || !session_token || !canal) {
      return new Response(
        JSON.stringify({ error: "Faltan campos: usuario_id, session_token, canal" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Sanitizar canal
    const canalClean = canal.replace(/[^a-zA-Z0-9\-_]/g, "");
    if (!canalClean || canalClean !== canal) {
      return new Response(
        JSON.stringify({ error: "Nombre de canal inválido" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Validar sesión contra tabla usuarios (Metepec - login por PIN)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: usuario, error: dbError } = await supabase
      .from("usuarios")
      .select("id, telefono, session_token, activo")
      .eq("id", usuario_id)
      .single();

    if (dbError || !usuario) {
      return new Response(
        JSON.stringify({ error: "Usuario no encontrado" }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // En Metepec el campo es "activo" (true = OK). Si está inactivo, bloquear.
    if (!usuario.activo) {
      return new Response(
        JSON.stringify({ error: "Usuario desactivado" }),
        { status: 403, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    if (usuario.session_token !== session_token) {
      return new Response(
        JSON.stringify({ error: "Sesión inválida o expirada" }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Generar token
    const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL;

    // Usar URI del frontend si viene, si no construirlo
    // Soporta: /hls/canal.m3u8  Y  /hls/canal/index.m3u8
    let streamUri: string;
    if (uri && typeof uri === "string" && uri.startsWith("/")) {
      streamUri = uri.replace(/[^a-zA-Z0-9\-_\/\.]/g, "");
    } else {
      streamUri = `/hls/${canalClean}/index.m3u8`;
    }

    // Hash SIN IP (CGNAT-safe) - mismo algoritmo que valida el cache VPS
    const rawString = `${STREAM_SECRET}${streamUri}${expires}`;
    const md5Bytes  = await md5Binary(rawString);
    const token     = base64url(md5Bytes);

    const tokenizedUrl = `${CACHE_DOMAIN}${streamUri}?token=${token}&expires=${expires}`;

    // Log de auditoría (opcional - la tabla stream_access_log debe existir)
    const clientIp = getClientIp(req);
    supabase.from("stream_access_log").insert({
      usuario_id,
      canal: canalClean,
      ip_address: clientIp,
      token_expires: new Date(expires * 1000).toISOString(),
    }).then(() => {}).catch(() => {});

    return new Response(
      JSON.stringify({
        url: tokenizedUrl,
        expires,
        canal: canalClean,
        ttl: TOKEN_TTL,
      }),
      {
        status: 200,
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    console.error("generate-stream-token error:", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor", detail: String(err) }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
