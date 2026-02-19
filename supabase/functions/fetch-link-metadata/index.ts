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

function badRequestResponse(message: string): Response {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status: 400,
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

// ============= URL VALIDATION =============
const isValidPublicUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    const hostname = parsed.hostname.toLowerCase();
    
    if (hostname === 'localhost' || hostname === 'host.docker.internal') {
      return false;
    }
    
    const privateIpPattern = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|169\.254\.|0\.)/;
    if (privateIpPattern.test(hostname)) {
      return false;
    }
    
    if (hostname === '::1' || hostname === '[::1]') {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

// ============= MAIN HANDLER =============
Deno.serve(async (req) => {
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return badRequestResponse('URL é obrigatória');
    }

    if (!isValidPublicUrl(url)) {
      console.warn('Blocked potentially malicious URL:', url);
      return badRequestResponse('URL inválida ou bloqueada por segurança');
    }

    console.log('Fetching metadata for URL:', url);

    let finalUrl = url;
    try {
      const headController = new AbortController();
      const headTimeout = setTimeout(() => headController.abort(), 5000);
      
      const headResponse = await fetch(url, {
        method: 'HEAD',
        signal: headController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MetadataBot/1.0)',
        },
        redirect: 'manual',
      });
      
      clearTimeout(headTimeout);
      
      if (headResponse.status >= 300 && headResponse.status < 400) {
        const location = headResponse.headers.get('Location');
        if (location) {
          finalUrl = location.startsWith('http') ? location : new URL(location, url).toString();
          console.log('Resolved short URL to:', finalUrl);
        }
      }
    } catch (headError) {
      console.log('HEAD request failed, will try GET:', headError instanceof Error ? headError.message : 'Unknown');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
      response = await fetch(finalUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MetadataBot/1.0)',
        },
        redirect: 'follow',
      });
      clearTimeout(timeout);
    } catch (fetchError) {
      clearTimeout(timeout);
      
      const errorMessage = fetchError instanceof Error ? fetchError.message : '';
      if (errorMessage.includes('redirect')) {
        console.log('Too many redirects, returning URL without metadata');
        return new Response(
          JSON.stringify({ 
            success: true,
            imageUrl: null,
            title: null,
            description: null,
            finalUrl: finalUrl,
            warning: 'Não foi possível buscar metadados - muitos redirecionamentos'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    
    const ogImageMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']/i);
    const ogTitleMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:title|twitter:title)["']\s+content=["']([^"']+)["']/i);
    const ogDescMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:description|twitter:description)["']\s+content=["']([^"']+)["']/i);
    
    const titleMatch = !ogTitleMatch ? html.match(/<title[^>]*>([^<]+)<\/title>/i) : null;
    
    let imageUrl = ogImageMatch ? ogImageMatch[1] : null;
    
    if (!imageUrl) {
      const faviconMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i);
      if (faviconMatch) {
        imageUrl = faviconMatch[1];
      }
    }

    if (imageUrl && !imageUrl.startsWith('http')) {
      const baseUrl = new URL(response.url);
      imageUrl = new URL(imageUrl, baseUrl.origin).toString();
    }

    const metadata = {
      success: true,
      imageUrl: imageUrl || null,
      title: (ogTitleMatch ? ogTitleMatch[1] : (titleMatch ? titleMatch[1] : null)),
      description: ogDescMatch ? ogDescMatch[1] : null,
      finalUrl: response.url,
    };

    console.log('Metadata extracted:', metadata);

    return new Response(
      JSON.stringify(metadata),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return handleError(error, 'fetch-link-metadata');
  }
});
