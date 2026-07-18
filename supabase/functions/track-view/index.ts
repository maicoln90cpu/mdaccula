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
    const { postId, eventId } = await req.json();

    if (!postId && !eventId) {
      return new Response(JSON.stringify({ error: 'postId ou eventId é obrigatório', success: false }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientIP = getClientIP(req);
    const resourceId = postId || eventId;

    if (isRateLimited(clientIP, resourceId)) {
      console.log(`Rate limited: IP ${clientIP} for resource ${resourceId}`);
      return jsonSuccess({ success: true, rateLimited: true });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const ipHash = clientIP !== 'unknown' ? clientIP : null;

    if (postId) {
      const { error } = await withTimeout(
        supabase.rpc('increment_post_views', { post_id: postId }),
        FUNCTION_TIMEOUT_MS
      );
      if (error) {
        console.error('Error incrementing post views:', error);
        throw error;
      }
      // Insert tracking event
      await supabase.from('blog_view_events').insert({ post_id: postId, ip_hash: ipHash })
        .then(({ error: e }) => { if (e) console.error('Error inserting blog_view_event:', e); });
      console.log(`Post view tracked: ${postId}`);
    }

    if (eventId) {
      const { error } = await withTimeout(
        supabase.rpc('increment_event_views', { event_id: eventId }),
        FUNCTION_TIMEOUT_MS
      );
      if (error) {
        console.error('Error incrementing event views:', error);
        throw error;
      }
      // Insert tracking event
      await supabase.from('event_view_events').insert({ event_id: eventId, ip_hash: ipHash })
        .then(({ error: e }) => { if (e) console.error('Error inserting event_view_event:', e); });
      console.log(`Event view tracked: ${eventId}`);
    }

    return jsonSuccess();
  } catch (error) {
    return handleError(error, 'track-view');
  }
});
