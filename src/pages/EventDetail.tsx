import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addHours } from "date-fns";
import { parseLocalDate, parseLocalDateTime, formatEventDateRange } from "@/lib/dateUtils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ShareButtons } from "@/components/ShareButtons";
import { Calendar, Clock, MapPin, ExternalLink, ChevronLeft, Users } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { getOptimizedImageUrl, handleImageFallback } from "@/lib/imageUtils";
import { StructuredData } from "@/components/StructuredData";

interface Event {
  id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  date: string;
  end_date?: string | null;
  time: string;
  end_time?: string;
  venue: string;
  location_city: string;
  location_state: string;
  genres: string[];
  lineup: string[];
  description: string;
  image_url: string;
  ticket_link: string;
  vip_link: string;
  blog_post_id: string | null;
  views: number;
  created_at: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  image_url: string;
  category: string;
  published_at: string;
}

const EventDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  // Main event query
  const { data: event, isLoading, error } = useQuery({
    queryKey: ["event-detail", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as Event | null;
    },
    enabled: !!slug,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Related blog post query
  const { data: relatedPost } = useQuery({
    queryKey: ["event-related-post", event?.blog_post_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, image_url, category, published_at")
        .eq("id", event!.blog_post_id!)
        .eq("published", true)
        .maybeSingle();
      return data as BlogPost | null;
    },
    enabled: !!event?.blog_post_id,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Related events query
  const { data: relatedEvents = [] } = useQuery({
    queryKey: ["event-related-events", event?.id, event?.genres],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, slug, venue, location_city, location_state, date, time, end_time, genres, lineup, description, image_url, ticket_link, vip_link, blog_post_id, views, created_at")
        .overlaps("genres", event!.genres)
        .neq("id", event!.id)
        .gte("date", new Date().toISOString().split("T")[0])
        .order("date", { ascending: true })
        .limit(5);

      if (!data) return [];
      const now = new Date();
      return (data as Event[]).filter(e => {
        const eventDateTime = parseLocalDateTime(e.date, e.time);
        return addHours(eventDateTime, 24) > now;
      }).slice(0, 3);
    },
    enabled: !!event?.id && !!event?.genres?.length,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Track view
  useEffect(() => {
    if (event?.id) {
      supabase.functions.invoke("track-view", { body: { eventId: event.id } })
        .catch((err) => console.error("Error tracking event view:", err));
    }
  }, [event?.id]);

  // Redirect if not found
  useEffect(() => {
    if (!isLoading && !event && !error) {
      navigate("/eventos");
    }
  }, [isLoading, event, error, navigate]);

  const formatDate = (dateStr: string) => {
    return parseLocalDate(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      weekday: "long",
    });
  };

  const formatTime = (timeStr: string) => {
    return timeStr.slice(0, 5);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-20 container mx-auto px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-96 bg-muted rounded-lg"></div>
            <div className="h-8 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!event) {
    return null;
  }

  const isListaVIP = event.ticket_link?.includes('postcontrol.com.br/mdaccula/lista');
  const ticketCardTitle = isListaVIP ? "Lista VIP/Social" : "Ingressos com Desconto";
  const ticketButtonText = isListaVIP ? "Enviar Nome para Lista" : "Comprar Ingresso";
  const currentUrl = `https://mdaccula.com/eventos/${event.slug}`;

  return (
    <>
      <Helmet>
        <title>{event.title} - MDAccula</title>
        <meta
          name="description"
          content={
            event.description ||
            `${event.title} acontece em ${formatDate(event.date)} no ${event.venue}, ${event.location_city} - ${event.location_state}`
          }
        />
        <meta property="og:title" content={event.title} />
        <meta property="og:description" content={event.description || `${event.genres.join(", ")} - ${event.venue}`} />
        <meta property="og:image" content={getOptimizedImageUrl(event.image_url) || "https://mdaccula.com/hero-club.jpg"} />
        <meta property="og:url" content={currentUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href={currentUrl} />
      </Helmet>
      <StructuredData
        type="event"
        data={{
          title: event.title,
          description: event.description,
          date: event.date,
          time: event.time,
          venue: event.venue,
          location_city: event.location_city,
          location_state: event.location_state,
          image_url: getOptimizedImageUrl(event.image_url) || undefined,
          ticket_link: event.ticket_link,
          lineup: event.lineup,
        }}
      />

      <div className="min-h-screen bg-background">
        <Navigation />

        <main className="pt-20 pb-16">
          <div className="container mx-auto px-4">
            {/* Breadcrumb */}
            <Breadcrumb className="mb-6">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/eventos">Eventos</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{event.title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {/* Back Button */}
            <Button variant="ghost" onClick={() => navigate("/eventos")} className="mb-6">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Voltar para eventos
            </Button>

            {/* Hero Image */}
            {event.image_url && (
              <div className="w-full h-[40vh] sm:h-[50vh] md:h-[60vh] rounded-xl overflow-hidden mb-6 sm:mb-8 shadow-lg bg-muted/20">
                <img src={getOptimizedImageUrl(event.image_url)} alt={event.title} className="w-full h-full object-contain" loading="lazy" onError={(e) => handleImageFallback(e)} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                {/* Title & Genre */}
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 leading-tight break-words">{event.title}</h1>
                  {event.subtitle && (
                    <p
                      data-testid="event-subtitle"
                      className="text-base sm:text-lg md:text-xl text-muted-foreground italic mb-4 break-words"
                    >
                      {event.subtitle}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {event.genres && event.genres.length > 0 ? (
                      event.genres.map((genre, index) => (
                        <Badge key={index} className="bg-primary/20 text-primary border-primary/30 text-sm sm:text-base px-3 sm:px-4 py-1">
                          🎵 {genre}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline">Gênero não especificado</Badge>
                    )}
                  </div>
                </div>

                {/* Mobile Ticket Card */}
                {(event.ticket_link || event.vip_link) && (
                  <Card className="lg:hidden">
                    <CardHeader>
                      <CardTitle>{ticketCardTitle}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {event.ticket_link && (
                        <Button asChild className="w-full" size="lg">
                          <a href={event.ticket_link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            {ticketButtonText}
                          </a>
                        </Button>
                      )}
                      {event.vip_link && (
                        <Button variant="secondary" asChild className="w-full" size="lg">
                          <a href={event.vip_link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Reservas de Camarote
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Event Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Detalhes do Evento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Data</p>
                        <p className="text-muted-foreground capitalize">{formatDate(event.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-secondary mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Horário</p>
                        <p className="text-muted-foreground">
                          {formatTime(event.time)}
                          {event.end_time && ` - ${formatTime(event.end_time)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-accent mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Local</p>
                        <p className="text-muted-foreground">
                          {event.venue}
                          <br />
                          {event.location_city} - {event.location_state}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Line-up */}
                {event.lineup && event.lineup.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Line-up
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {event.lineup.map((artist, index) => (
                          <Badge key={index} variant="outline" className="text-base px-3 py-1">
                            {artist}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Description */}
                {event.description && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Sobre o Evento</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{event.description}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Related Blog Post */}
                {relatedPost && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader>
                      <CardTitle>📰 Artigo Relacionado</CardTitle>
                      <CardDescription>Saiba mais sobre este evento no nosso blog</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link to={`/blog/${relatedPost.slug}`}>
                        <div className="group cursor-pointer">
                          {relatedPost.image_url && (
                            <div className="w-full h-48 rounded-lg overflow-hidden mb-4">
                              <img
                                src={getOptimizedImageUrl(relatedPost.image_url)}
                                alt={relatedPost.title}
                                className="w-full h-full object-contain"
                                onError={(e) => handleImageFallback(e)}
                              />
                            </div>
                          )}
                          <Badge className="mb-2">{relatedPost.category}</Badge>
                          <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                            {relatedPost.title}
                          </h3>
                          <p className="text-muted-foreground">{relatedPost.excerpt}</p>
                          <Button variant="link" className="mt-2 p-0">
                            Ler artigo completo →
                          </Button>
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Ticket Buttons - Desktop only */}
                {(event.ticket_link || event.vip_link) && (
                  <Card className="hidden lg:block">
                    <CardHeader>
                      <CardTitle>{ticketCardTitle}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {event.ticket_link && (
                        <Button asChild className="w-full" size="lg">
                          <a href={event.ticket_link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            {ticketButtonText}
                          </a>
                        </Button>
                      )}
                      {event.vip_link && (
                        <Button variant="secondary" asChild className="w-full" size="lg">
                          <a href={event.vip_link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Reservas de Camarote
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Share */}
                <Card>
                  <CardHeader>
                    <CardTitle>Compartilhar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ShareButtons
                      url={currentUrl}
                      title={event.title}
                      description={event.description || `${event.genres.join(", ")} - ${event.venue}`}
                    />
                  </CardContent>
                </Card>

                {/* Related Events */}
                {relatedEvents.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Eventos Similares</CardTitle>
                      <CardDescription>Outros eventos de {event.genres.join(", ")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {relatedEvents.map((relatedEvent) => (
                        <Link key={relatedEvent.id} to={`/eventos/${relatedEvent.slug}`} className="block group">
                          <div className="flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                            {relatedEvent.image_url && (
                              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                <img
                                  src={getOptimizedImageUrl(relatedEvent.image_url)}
                                  alt={relatedEvent.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => handleImageFallback(e)}
                                />
                              </div>
                            )}
                            <div className="min-w-0">
                              <h4 className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                                {relatedEvent.title}
                              </h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                {parseLocalDate(relatedEvent.date).toLocaleDateString("pt-BR")} • {relatedEvent.venue}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default EventDetail;
