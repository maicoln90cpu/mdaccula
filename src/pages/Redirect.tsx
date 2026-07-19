import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Normalize URLs that may be missing protocol
const normalizeUrl = (raw: string): string => {
  let url = raw.trim().replace(/^→\s*/, '');
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
};

const Redirect = () => {
  const { slug } = useParams<{ slug: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError('Link inválido.');
      return;
    }

    const doRedirect = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('redirect_links')
          .select('destination_url, utm_source, utm_medium, utm_campaign, utm_content, enabled')
          .eq('slug', slug)
          .eq('enabled', true)
          .maybeSingle();

        if (fetchError || !data) {
          setError('Link não encontrado ou desativado.');
          return;
        }

        // Normalize destination URL (add https:// if missing)
        const normalizedUrl = normalizeUrl(data.destination_url);

        // Build final URL with UTMs
        let finalUrl = normalizedUrl;
        try {
          const url = new URL(normalizedUrl);
          if (data.utm_source) url.searchParams.set('utm_source', data.utm_source);
          if (data.utm_medium) url.searchParams.set('utm_medium', data.utm_medium);
          if (data.utm_campaign) url.searchParams.set('utm_campaign', data.utm_campaign);
          if (data.utm_content) url.searchParams.set('utm_content', data.utm_content);
          finalUrl = url.toString();
        } catch {
          // Just use normalized URL as-is
        }

        // Fire-and-forget tracking
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        fetch(`${supabaseUrl}/functions/v1/track-redirect-click`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
          },
          body: JSON.stringify({ slug }),
        }).catch(() => {});

        // Redirect
        window.location.replace(finalUrl);
      } catch {
        setError('Erro ao processar redirecionamento.');
      }
    };

    doRedirect();
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Oops!</h1>
          <p className="text-muted-foreground">{error}</p>
          <a href="/" className="text-primary hover:underline">
            Voltar para o site
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
};

export default Redirect;
