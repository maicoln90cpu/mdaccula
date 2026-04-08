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

// ============= TYPES =============
interface SitemapUrl {
  loc: string;
  lastmod?: string;
  priority: number;
  changefreq: string;
}

// ============= MAIN HANDLER =============
Deno.serve(async (req) => {
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('published', true)
      .order('updated_at', { ascending: false });

    const { data: events } = await supabase
      .from('events')
      .select('slug, updated_at')
      .gte('date', new Date().toISOString().split('T')[0])
      .order('updated_at', { ascending: false });

    const baseUrl = 'https://mdaccula.com';
    
    const staticPages: SitemapUrl[] = [
      { loc: '/', priority: 1.0, changefreq: 'daily' },
      { loc: '/eventos', priority: 0.95, changefreq: 'daily' },
      { loc: '/blog', priority: 0.95, changefreq: 'daily' },
      { loc: '/MDAcculaRadio', priority: 0.85, changefreq: 'weekly' },
      { loc: '/quem-somos', priority: 0.8, changefreq: 'weekly' },
      { loc: '/contato', priority: 0.8, changefreq: 'monthly' },
      { loc: '/links', priority: 0.7, changefreq: 'monthly' },
      { loc: '/busca', priority: 0.6, changefreq: 'weekly' },
    ];

    const blogPages: SitemapUrl[] = (posts || []).map(p => ({
      loc: `/blog/${p.slug}`,
      lastmod: p.updated_at,
      priority: 0.8,
      changefreq: 'weekly'
    }));

    const eventPages: SitemapUrl[] = (events || []).map(e => ({
      loc: `/eventos/${e.slug}`,
      lastmod: e.updated_at,
      priority: 0.9,
      changefreq: 'weekly'
    }));

    const allUrls = [...staticPages, ...blogPages, ...eventPages];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  ${allUrls.map(u => `
  <url>
    <loc>${baseUrl}${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : `<lastmod>${new Date().toISOString()}</lastmod>`}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('')}
</urlset>`;

    console.log(`Sitemap generated: ${allUrls.length} URLs`);

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      }
    });

  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
