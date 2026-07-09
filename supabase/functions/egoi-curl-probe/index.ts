// Edge function descartável — validar API E-goi antes de codar a integração.
// Testa 3 variações de header (Apikey, ApiKey, apikey) contra GET /lists e /senders.
// Após validar, esta função pode ser deletada.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const BASE = 'https://api.egoiapp.com';

async function tryHeader(headerName: string, apiKey: string, path: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    headers: {
      [headerName]: apiKey,
      'Accept': 'application/json',
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* keep as text */ }
  return {
    header: headerName,
    path,
    status: res.status,
    ok: res.ok,
    contentType: res.headers.get('content-type'),
    bodyPreview: typeof body === 'string' ? body.slice(0, 500) : body,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const apiKey = Deno.env.get('EGOI_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'EGOI_API_KEY not set' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const variants = ['Apikey', 'ApiKey', 'apikey'];
  const paths = ['/lists', '/senders'];

  const results = [];
  for (const path of paths) {
    for (const h of variants) {
      try {
        results.push(await tryHeader(h, apiKey, path));
      } catch (e) {
        results.push({ header: h, path, error: (e as Error).message });
      }
    }
  }

  const winner = results.find((r) => 'ok' in r && r.ok);

  return new Response(
    JSON.stringify({
      keyPreview: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)} (len=${apiKey.length})`,
      winner: winner ? { header: winner.header, path: winner.path, status: winner.status } : null,
      results,
    }, null, 2),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
