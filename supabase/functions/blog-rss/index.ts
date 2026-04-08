import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============= EGRESS TRACKING HELPER =============
function logEgress(supabase: ReturnType<typeof createClient>, apiPath: string, data: unknown) {
  try {
    const bytes = data ? new TextEncoder().encode(JSON.stringify(data)).length : 0;
    const now = new Date();
    now.setMinutes(0, 0, 0);
    supabase.from('egress_metrics').upsert({
      period_start: now.toISOString(),
      api_path: `/rest/v1/${apiPath}`,
      source: 'edge',
      cache_hits: 0,
      cache_misses: 1,
      egress_bytes: bytes,
    }, { onConflict: 'period_start,api_path,source' }).then(() => {}).catch(() => {});
  } catch (_) { /* fire and forget */ }
}

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

function handleError(error: unknown, functionName: string): Response {
  console.error(`Error in ${functionName}:`, error);
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new Response(JSON.stringify({ error: message, success: false }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============= MAIN HANDLER =============
Deno.serve(async (req) => {
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Buscando posts publicados para RSS feed...');
    
    const { data: posts, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('published', true)
      .order('published_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Erro ao buscar posts:', error);
      throw error;
    }

    console.log(`Posts encontrados: ${posts?.length || 0}`);

    const siteUrl = 'https://mdaccula.com';
    const buildDate = new Date().toUTCString();

    const rssItems = posts?.map(post => {
      const pubDate = post.published_at 
        ? new Date(post.published_at).toUTCString() 
        : new Date(post.created_at).toUTCString();
      
      const imageHtml = post.image_url 
        ? `<img src="${post.image_url}" alt="${post.title}" style="max-width:100%;height:auto;border-radius:8px;margin-bottom:16px;" />`
        : '';
      
      const enclosureTag = post.image_url 
        ? `<enclosure url="${post.image_url}" type="image/jpeg" />`
        : '';
      
      const textContent = post.excerpt || post.content.replace(/<[^>]*>/g, '').substring(0, 200) + '...';
      const description = `${imageHtml}<p>${textContent}</p>`;
      
      return `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${siteUrl}/blog/${post.slug}</link>
      <guid>${siteUrl}/blog/${post.slug}</guid>
      <description><![CDATA[${description}]]></description>
      <pubDate>${pubDate}</pubDate>
      <category>${post.category}</category>
      ${enclosureTag}
    </item>`;
    }).join('') || '';

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>MD Accula Blog</title>
    <link>${siteUrl}/blog</link>
    <description>Notícias e novidades da cena eletrônica de São Paulo</description>
    <language>pt-BR</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${siteUrl}/functions/v1/blog-rss" rel="self" type="application/rss+xml" />
    ${rssItems}
  </channel>
</rss>`;

    console.log('RSS feed gerado com sucesso');

    return new Response(rssXml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    return handleError(error, 'blog-rss');
  }
});
