import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function handleCorsPreFlight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

function isRateLimited(ip: string, resourceId?: string, maxRequests = 10, windowMs = 60000): boolean {
  const key = resourceId ? `${ip}:${resourceId}` : ip;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (rateLimitMap.size > 10000) {
    const cutoff = now - windowMs * 2;
    for (const [k, e] of rateLimitMap.entries()) {
      if (e.timestamp < cutoff) rateLimitMap.delete(k);
    }
  }

  if (!entry || now - entry.timestamp > windowMs) {
    rateLimitMap.set(key, { count: 1, timestamp: now });
    return false;
  }

  if (entry.count >= maxRequests) return true;
  entry.count++;
  return false;
}

function getClientIP(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  try {
    const { slug } = await req.json();

    if (!slug || typeof slug !== 'string') {
      return new Response(JSON.stringify({ error: 'slug é obrigatório', success: false }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientIP = getClientIP(req);

    if (isRateLimited(clientIP, slug)) {
      console.log(`Rate limited: ${clientIP} for slug: ${slug}`);
      return new Response(JSON.stringify({ error: 'Rate limit exceeded', success: false }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.rpc('increment_redirect_clicks', { redirect_slug: slug });

    if (error) {
      console.error('Error incrementing redirect clicks:', error);
      throw error;
    }

    console.log(`Redirect click tracked: ${slug}`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in track-redirect-click:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message, success: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
