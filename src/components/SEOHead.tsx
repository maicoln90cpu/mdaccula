import { Helmet } from 'react-helmet-async';
import { useEffect, useMemo } from 'react';
import { getOptimizedImageUrl } from '@/lib/imageUtils';

// ⚠️ Este arquivo está listado em SEO_TEMPLATE_FILES (scripts/prerender.mjs)
// — mudanças aqui invalidam automaticamente o cache incremental do pipeline
// de prerender (força uma varredura completa no próximo run). Se você criar
// um componente NOVO que também gera/afeta title/meta/JSON-LD renderizado
// nas páginas públicas, adicione o caminho dele em SEO_TEMPLATE_FILES lá.

interface SEOProps {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  type?: 'website' | 'article';
  url?: string;
  noindex?: boolean;
  article?: {
    publishedTime: string;
    author: string;
    tags: string[];
  };
}

export const SEOHead = ({
  title,
  description,
  keywords = [],
  image = 'https://mdaccula.com/logo-mdaccula.jpeg',
  type = 'website',
  url = 'https://mdaccula.com',
  noindex = false,
  article,
}: SEOProps) => {
  const fullTitle = `${title} | MDAccula`;
  const defaultKeywords = [
    'música eletrônica',
    'techno',
    'house',
    'são paulo',
    'eventos',
    'festas',
    'dj',
  ];
  const allKeywords = [...new Set([...defaultKeywords, ...keywords])];
  const optimizedImage = useMemo(() => getOptimizedImageUrl(image) || image, [image]);

  // react-helmet-async v3, sob React 19, usa a hoist nativa de <title>/<meta>/<link> do
  // React em vez do mecanismo antigo (substituir no DOM qualquer tag com [data-rh]) — então
  // ele nunca mais enxerga/remove as tags estáticas de fallback do index.html, e elas
  // ficariam duplicadas ao lado das que este componente gera. Como o SEOHead cobre todas
  // essas tags em toda rota que o usa, é seguro removê-las assim que o JS assume.
  // <title> não aceita o atributo data-rh (react-helmet-async só cria uma tag nova ao
  // lado, nunca reconhece a existente) — removida à parte, pelo id do index.html.
  useEffect(() => {
    document.querySelectorAll('head [data-rh="true"]').forEach((tag) => tag.remove());
    document.getElementById('shell-title')?.remove();
  }, []);

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={allKeywords.join(', ')} />
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={optimizedImage} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="MDAccula" />
      <meta property="og:locale" content="pt_BR" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={optimizedImage} />

      {/* Canonical URL */}
      <link rel="canonical" href={url} />

      {/* Article specific meta tags */}
      {article && type === 'article' && (
        <>
          <meta property="article:published_time" content={article.publishedTime} />
          <meta property="article:author" content={article.author} />
          <meta property="article:section" content="Música Eletrônica" />
          {article.tags.map((tag) => (
            <meta key={tag} property="article:tag" content={tag} />
          ))}
        </>
      )}
    </Helmet>
  );
};
