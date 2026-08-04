// Proxy para Google Static Maps via connector gateway.
// Motivação: a chave browser é referrer-restricted e falha quando o client
// de e-mail carrega a imagem. Este proxy chama o gateway (sem restrição)
// e devolve os bytes com cache longo, para o <img src=...> do e-mail.
//
// Cache-first no Bunny CDN: antes de chamar o Google, verifica se já existe
// uma imagem salva para essas coordenadas/zoom/tamanho/estilo/pin (a chave
// do cache é derivada desses parâmetros). Se existir, redireciona pro CDN
// sem gastar chamada de API. Isso vale tanto pro e-mail quanto pro preview
// ao vivo do editor de blocos — e como a chave muda junto com o endereço,
// uma chamada nova ao Google só acontece quando o admin edita a localização
// do evento (coordenadas diferentes = arquivo de cache diferente).
//
// verify_jwt = false (público). Só GET. Rate limit natural via cache.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { bunnyFileExists, uploadBytesToBunny } from '../_shared/bunnyUploadBytes.ts';
import { buildMapPath, type MapRenderParams } from '../_shared/renderStaticMapCache.ts';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps';
const BUNNY_CDN_HOST = 'https://mdaccula.b-cdn.net';

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
    const cachePath = buildMapPath(cacheParams);
    if (await bunnyFileExists(cachePath)) {
      return Response.redirect(`${BUNNY_CDN_HOST}/${cachePath}`, 302);
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Google Maps connector not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const staticMapUrl = new URL(`${GATEWAY_URL}/maps/api/staticmap`);
    staticMapUrl.searchParams.set('center', `${lat},${lng}`);
    staticMapUrl.searchParams.set('zoom', String(zoom));
    staticMapUrl.searchParams.set('size', `${w}x${h}`);
    staticMapUrl.searchParams.set('scale', '2'); // retina
    staticMapUrl.searchParams.set('maptype', mapType);
    staticMapUrl.searchParams.set('markers', `color:${pinColor}|${lat},${lng}`);

    const upstream = await fetch(staticMapUrl.toString(), {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY,
      },
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error(`[render-static-map] gateway failed ${upstream.status}: ${errText}`);
      return new Response(JSON.stringify({ error: 'Upstream failed', status: upstream.status, details: errText }), {
        status: upstream.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bytes = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('Content-Type') || 'image/png';

    try {
      await uploadBytesToBunny(bytes, cachePath, contentType);
    } catch (cacheErr) {
      // Não bloqueia a resposta ao usuário se o cache falhar — só loga.
      console.warn('[render-static-map] failed to cache to Bunny:', cacheErr);
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
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
