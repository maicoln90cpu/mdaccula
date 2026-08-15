// Proxy para Google Static Maps.
// Motivação: a chave browser é referrer-restricted e falha quando o client
// de e-mail carrega a imagem. Este proxy chama o Google direto com uma chave
// própria server-only (GOOGLE_MAPS_API_KEY, restrição "Nenhuma") e devolve os
// bytes com cache longo, para o <img src=...> do e-mail.
//
// Cache-first no Bunny CDN: antes de chamar o Google, verifica se já existe
// uma imagem salva para essas coordenadas/zoom/tamanho/estilo/pin (a chave
// do cache é derivada desses parâmetros). Se existir, redireciona pro CDN
// sem gastar chamada de API. Isso vale tanto pro e-mail quanto pro preview
// ao vivo do editor de blocos — e como a chave muda junto com o endereço,
// uma chamada nova ao Google só acontece quando o admin edita a localização
// do evento (coordenadas diferentes = arquivo de cache diferente).
//
// 15/08/2026 — trocado de connector-gateway.lovable.dev (passou a devolver
// 401 "Credential not found" depois da rotação de segredos por causa do
// repositório ter ficado público) para chamar a API do Google diretamente.
// Timeout explícito (mesma lição do R-057: fetch sem timeout pode travar a
// function inteira).
//
// verify_jwt = false (público). Só GET. Rate limit natural via cache.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { resolveMapImage, type MapRenderParams } from '../_shared/renderStaticMapCache.ts';

const GOOGLE_STATIC_MAP_URL = 'https://maps.googleapis.com/maps/api/staticmap';
const GOOGLE_MAPS_REQUEST_TIMEOUT_MS = 15_000;

class GoogleMapsKeyNotConfiguredError extends Error {}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    const zoom = Math.max(10, Math.min(19, Number(url.searchParams.get('zoom') || '15')));
    const w = Math.max(200, Math.min(640, Number(url.searchParams.get('w') || '600')));
    const h = Math.max(150, Math.min(400, Number(url.searchParams.get('h') || '300')));
    const style = (url.searchParams.get('style') || 'roadmap');
    const mapType = ['roadmap', 'terrain', 'satellite', 'hybrid'].includes(style) ? style : 'roadmap';
    // Cor do pin: aceita nome de cor do Google (ex.: red, blue) ou hex #RRGGBB.
    // Mantém o valor "cru" (cachePinColor) pra chave do cache — igual ao que
    // parseRenderStaticMapUrl usa do lado do e-mail — e só converte pra
    // 0xRRGGBB (formato exigido pela Static Maps API) na hora de chamar o Google.
    const rawPinColor = (url.searchParams.get('pincolor') || '').trim();
    const cachePinColor = /^#[0-9a-fA-F]{6}$/.test(rawPinColor)
      ? rawPinColor
      : /^[a-zA-Z]+$/.test(rawPinColor) ? rawPinColor : 'red';
    const pinColor = cachePinColor.startsWith('#') ? `0x${cachePinColor.slice(1)}` : cachePinColor;

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return new Response(JSON.stringify({ error: 'Invalid lat/lng' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cacheParams: MapRenderParams = { lat, lng, zoom, w, h, style: mapType, pinColor: cachePinColor };

    const generateImage = () => {
      const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
      if (!GOOGLE_MAPS_API_KEY) {
        throw new GoogleMapsKeyNotConfiguredError();
      }

      const staticMapUrl = new URL(GOOGLE_STATIC_MAP_URL);
      staticMapUrl.searchParams.set('center', `${lat},${lng}`);
      staticMapUrl.searchParams.set('zoom', String(zoom));
      staticMapUrl.searchParams.set('size', `${w}x${h}`);
      staticMapUrl.searchParams.set('scale', '2'); // retina
      staticMapUrl.searchParams.set('maptype', mapType);
      staticMapUrl.searchParams.set('markers', `color:${pinColor}|${lat},${lng}`);
      staticMapUrl.searchParams.set('key', GOOGLE_MAPS_API_KEY);

      return fetch(staticMapUrl.toString(), {
        signal: AbortSignal.timeout(GOOGLE_MAPS_REQUEST_TIMEOUT_MS),
      });
    };

    let resolved;
    try {
      resolved = await resolveMapImage(cacheParams, generateImage);
    } catch (err) {
      if (err instanceof GoogleMapsKeyNotConfiguredError) {
        return new Response(JSON.stringify({ error: 'GOOGLE_MAPS_API_KEY não configurada' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw err;
    }

    if (resolved.source === 'bunny') {
      return Response.redirect(resolved.bunnyUrl, 302);
    }

    return new Response(resolved.bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': resolved.contentType,
        // Cache 7 dias no CDN + no cliente de e-mail
        'Cache-Control': 'public, max-age=604800, s-maxage=604800',
      },
    });
  } catch (err) {
    console.error('[render-static-map] unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
