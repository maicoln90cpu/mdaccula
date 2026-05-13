import { Helmet } from 'react-helmet-async';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface ArticleData {
  title: string;
  excerpt?: string;
  image_url?: string;
  published_at?: string;
  updated_at?: string;
  slug: string;
  tags?: string[];
  category?: string;
}

interface EventData {
  title: string;
  description?: string;
  date: string;
  end_date?: string | null;
  time: string;
  end_time?: string | null;
  venue: string;
  location_city: string;
  location_state: string;
  image_url?: string;
  ticket_link?: string;
  lineup?: string[];
}

interface OrganizationData {
  instagram_link?: string;
  soundcloud_link?: string;
  whatsapp_number?: string;
}

interface BreadcrumbData {
  items: BreadcrumbItem[];
}

type StructuredDataPayload =
  | ArticleData
  | EventData
  | OrganizationData
  | BreadcrumbData
  | Record<string, unknown>
  | undefined;

interface StructuredDataProps {
  type: 'website' | 'article' | 'event' | 'organization' | 'breadcrumb' | 'musicgroup' | 'localbusiness';
  data?: StructuredDataPayload;
}

export const StructuredData = ({ type, data }: StructuredDataProps) => {
  const getSchema = () => {
    switch (type) {
      case 'website':
        return {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "MDAccula",
          "url": "https://mdaccula.com",
          "description": "A maior agência de música eletrônica de São Paulo. Eventos, festas e conteúdo sobre techno, house e cultura eletrônica.",
          "potentialAction": {
            "@type": "SearchAction",
            "target": {
              "@type": "EntryPoint",
              "urlTemplate": "https://mdaccula.com/blog?search={search_term_string}"
            },
            "query-input": "required name=search_term_string"
          }
        };

      case 'organization': {
        const orgData = data as OrganizationData | undefined;
        return {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "MDAccula",
          "url": "https://mdaccula.com",
          "logo": "https://mdaccula.com/logo.png",
          "description": "Agência especializada em música eletrônica em São Paulo - DJ, eventos techno, house e festas underground",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "São Paulo",
            "addressRegion": "SP",
            "addressCountry": "BR"
          },
          "sameAs": [
            orgData?.instagram_link || "https://instagram.com/mdaccula",
            orgData?.soundcloud_link || "https://soundcloud.com/mdaccula"
          ],
          "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "Customer Service",
            "availableLanguage": ["Portuguese", "English"]
          }
        };
      }

      case 'musicgroup': {
        const musicData = data as OrganizationData | undefined;
        return {
          "@context": "https://schema.org",
          "@type": "MusicGroup",
          "name": "MDAccula",
          "url": "https://mdaccula.com",
          "genre": ["Electronic", "Techno", "House", "Underground"],
          "description": "DJ e promoter de música eletrônica em São Paulo, especializado em techno e house",
          "sameAs": [
            musicData?.instagram_link || "https://instagram.com/mdaccula",
            musicData?.soundcloud_link || "https://soundcloud.com/mdaccula"
          ],
          "location": {
            "@type": "Place",
            "name": "São Paulo",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "São Paulo",
              "addressRegion": "SP",
              "addressCountry": "BR"
            }
          }
        };
      }

      case 'localbusiness': {
        const localData = data as OrganizationData | undefined;
        return {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": "MDAccula",
          "url": "https://mdaccula.com",
          "description": "Maior agência de música eletrônica de São Paulo - Eventos, festas techno e house",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "São Paulo",
            "addressRegion": "SP",
            "addressCountry": "BR"
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": "-23.550520",
            "longitude": "-46.633308"
          },
          "priceRange": "$$",
          "telephone": localData?.whatsapp_number || "+55 11 99999-9999",
          "openingHours": "Mo-Fr 09:00-18:00, Sa 10:00-16:00",
          "sameAs": [
            localData?.instagram_link || "https://instagram.com/mdaccula",
            localData?.soundcloud_link || "https://soundcloud.com/mdaccula"
          ]
        };
      }

      case 'article': {
        const articleData = data as ArticleData;
        return {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": articleData.title,
          "description": articleData.excerpt,
          "image": articleData.image_url,
          "datePublished": articleData.published_at,
          "dateModified": articleData.updated_at,
          "author": {
            "@type": "Organization",
            "name": "MDAccula"
          },
          "publisher": {
            "@type": "Organization",
            "name": "MDAccula",
            "logo": {
              "@type": "ImageObject",
              "url": "https://mdaccula.com/logo.png"
            }
          },
          "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": `https://mdaccula.com/blog/${articleData.slug}`
          },
          "keywords": articleData.tags?.join(', '),
          "articleSection": articleData.category
        };
      }

      case 'event': {
        const eventData = data as EventData;
        const startDate = `${eventData.date}T${eventData.time}`;
        // endDate: usa end_date + end_time quando festival, senão start+end_time, senão omite
        const endDateRaw =
          eventData.end_date
            ? `${eventData.end_date}T${eventData.end_time || eventData.time}`
            : eventData.end_time
              ? `${eventData.date}T${eventData.end_time}`
              : undefined;
        return {
          "@context": "https://schema.org",
          "@type": "MusicEvent",
          "name": eventData.title,
          "description": eventData.description,
          "startDate": startDate,
          ...(endDateRaw ? { "endDate": endDateRaw } : {}),
          "eventStatus": "https://schema.org/EventScheduled",
          "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
          "location": {
            "@type": "Place",
            "name": eventData.venue,
            "address": {
              "@type": "PostalAddress",
              "addressLocality": eventData.location_city,
              "addressRegion": eventData.location_state,
              "addressCountry": "BR"
            }
          },
          "image": eventData.image_url,
          "offers": eventData.ticket_link ? {
            "@type": "Offer",
            "url": eventData.ticket_link,
            "availability": "https://schema.org/InStock"
          } : undefined,
          "performer": eventData.lineup?.map((artist: string) => ({
            "@type": "MusicGroup",
            "name": artist
          })),
          "organizer": {
            "@type": "Organization",
            "name": "MDAccula",
            "url": "https://mdaccula.com"
          }
        };
      }

      case 'breadcrumb': {
        const breadcrumbData = data as BreadcrumbData;
        return {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": breadcrumbData.items.map((item: BreadcrumbItem, index: number) => ({
            "@type": "ListItem",
            "position": index + 1,
            "name": item.name,
            "item": item.url
          }))
        };
      }

      default:
        return null;
    }
  };

  const schema = getSchema();
  if (!schema) return null;

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};
