import { createClient } from "npm:@supabase/supabase-js@2";

// ============= INLINE SHARED UTILITIES =============
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
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

function jsonSuccess(data: Record<string, unknown> = { success: true }, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function handleError(error: unknown, functionName: string): Response {
  console.error(`Error in ${functionName}:`, error);
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new Response(JSON.stringify({ error: message, success: false }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============= MAIN HANDLER =============
const FUNCTION_TIMEOUT_MS = 10000;

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  try {
    const { linkId } = await req.json();

    if (!linkId) {
      return new Response(JSON.stringify({ error: 'linkId é obrigatório', success: false }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientIP = getClientIP(req);

    if (isRateLimited(clientIP, linkId)) {
      console.log(`Rate limited: ${clientIP} for linkId: ${linkId}`);
      return new Response(JSON.stringify({ error: 'Rate limit exceeded', success: false }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await withTimeout(
      supabase.rpc('increment_link_clicks', { link_id: linkId }),
      FUNCTION_TIMEOUT_MS
    );

    if (error) {
      console.error('Error incrementing clicks:', error);
      throw error;
    }

    // Insert tracking event with timestamp
    const ipHash = clientIP !== 'unknown' ? clientIP : null;
    await supabase.from('link_click_events').insert({
      link_id: linkId,
      ip_hash: ipHash,
    }).then(({ error: trackError }) => {
      if (trackError) console.error('Error inserting link_click_event:', trackError);
    });

    console.log(`Link click tracked: ${linkId}`);
    return jsonSuccess();
  } catch (error) {
    return handleError(error, 'track-link-click');
  }
});
