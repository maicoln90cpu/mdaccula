import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addHours } from "date-fns";
import { parseLocalDate, parseLocalDateTime } from "@/lib/dateUtils";
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
import { useToast } from "@/hooks/useToast";
import { Helmet } from "react-helmet-async";
import { getOptimizedImageUrl } from "@/lib/imageUtils";

interface Event {
  id: string;
  title: string;
  slug: string;
  date: string;
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
  const { toast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [relatedPost, setRelatedPost] = useState<BlogPost | null>(null);
  const [relatedEvents, setRelatedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      fetchEventData();
    }
  }, [slug]);

  const fetchEventData = async () => {
    try {
      setLoading(true);

      // Buscar evento pelo slug
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (eventError) throw eventError;

      if (!eventData) {
        toast({
          title: "Evento não encontrado",
          description: "O evento que você procura não existe.",
          variant: "destructive",
        });
        navigate("/eventos");
        return;
      }

      setEvent(eventData);

      // Incrementar views
      await supabase.rpc("increment_event_views", { event_id: eventData.id });

      // Buscar blog post relacionado se existir
      if (eventData.blog_post_id) {
        const { data: postData } = await supabase
          .from("blog_posts")
          .select("id, title, slug, excerpt, image_url, category, published_at")
          .eq("id", eventData.blog_post_id)
          .eq("published", true)
          .maybeSingle();

        if (postData) {
          setRelatedPost(postData);
        }
      }

      // Buscar eventos relacionados (mesmos gêneros, excluindo o atual)
      const { data: relatedData } = await supabase
        .from("events")
        .select("*")
        .overlaps("genres", eventData.genres)
        .neq("id", eventData.id)
        .gte("date", new Date().toISOString().split("T")[0])
        .order("date", { ascending: true })
        .limit(10);

      if (relatedData) {
        // Filtrar eventos - só ocultar 24h após o horário de início
        const now = new Date();
        const futureRelatedEvents = relatedData.filter(event => {
          const eventDateTime = parseLocalDateTime(event.date, event.time);
          const eventEndTime = addHours(eventDateTime, 24);
          return eventEndTime > now;
        });
        
        setRelatedEvents(futureRelatedEvents.slice(0, 3));
      }
    } catch (error) {
      console.error("Error fetching event:", error);
      toast({
        title: "Erro ao carregar evento",
        description: "Não foi possível carregar os dados do evento.",
        variant: "destructive",
      });
      navigate("/eventos");
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
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
        <meta property="og:image" content={getOptimizedImageUrl(event.image_url) || "/hero-club.jpg"} />
        <meta property="og:url" content={currentUrl} />
        <meta property="og:type" content="event" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href={currentUrl} />
      </Helmet>

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
                <img src={getOptimizedImageUrl(event.image_url)} alt={event.title} className="w-full h-full object-contain" loading="lazy" />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                {/* Title & Genre */}
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight break-words">{event.title}</h1>
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

                {/* Mobile Ticket Card - Only visible on small screens */}
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
                          <div className="space-y-2">
                            {relatedEvent.image_url && (
                              <div className="w-full h-32 rounded-lg overflow-hidden">
                                <img
                                  src={getOptimizedImageUrl(relatedEvent.image_url)}
                                  alt={relatedEvent.title}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            )}
                            <h4 className="font-semibold group-hover:text-primary transition-colors line-clamp-2">
                              {relatedEvent.title}
                            </h4>
                            <p className="text-sm text-muted-foreground">{formatDate(relatedEvent.date)}</p>
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
