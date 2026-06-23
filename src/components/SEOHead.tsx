import { Helmet } from 'react-helmet-async';
import { useMemo } from 'react';
import { getOptimizedImageUrl } from '@/lib/imageUtils';

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
  image = 'https://mdaccula.com/hero-club.jpg',
  type = 'website',
  url = 'https://mdaccula.com',
  noindex = false,
  article 
}: SEOProps) => {
  const fullTitle = `${title} | MDAccula`;
  const defaultKeywords = ['música eletrônica', 'techno', 'house', 'são paulo', 'eventos', 'festas', 'dj'];
  const allKeywords = [...new Set([...defaultKeywords, ...keywords])];
  const optimizedImage = useMemo(() => getOptimizedImageUrl(image) || image, [image]);

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={allKeywords.join(', ')} />
      
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
          {article.tags.map(tag => (
            <meta key={tag} property="article:tag" content={tag} />
          ))}
        </>
      )}
    </Helmet>
  );
};
