import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { TicketDayPickerModal } from '@/components/events/TicketDayPickerModal';
import { EventCountdown } from '@/components/events/EventCountdown';
import { SpotlightCard } from '@/components/effects/SpotlightCard';
import { safeExternalUrl } from '@/lib/safeExternalUrl';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/ui/navigation';
import Footer from '@/components/ui/footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { addHours } from 'date-fns';
import { cn } from '@/lib';
import { parseLocalDate, parseLocalDateTime, formatEventDateRange } from '@/lib/dateUtils';
import { parseSchedule } from '@/lib/eventScheduleHelper';
import { normalizeLineup } from '@/lib/lineupNormalizer';
import { EVENT_PUBLIC_FIELDS } from '@/lib/eventSelectFields';
import { getEventCtaButtonLabel, getEventCtaCardTitle } from '@shared/eventCta.ts';
import { buildPixWhatsAppLink } from '@shared/pixWhatsAppLink.ts';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ShareButtons } from '@/components/ShareButtons';
import { SoundWaveBackground } from '@/components/SoundWaveBackground';
import { Calendar, Clock, MapPin, ExternalLink, ChevronLeft, Users } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import {
  getOptimizedImageUrl,
  getThumbnailUrl,
  getMediumUrl,
  handleImageFallback,
  handleThumbImageFallback,
} from '@/lib/imageUtils';
import { StructuredData } from '@/components/StructuredData';
import { EventLocationMap } from '@/components/events/EventLocationMap';

// CTA principal de compra — reaproveitado no card mobile, card desktop e na barra fixa mobile.
const TICKET_CTA_CLASSES =
  'w-full btn-ticket-glow animate-ticket-glow-pulse animate-ticket-glow-shift animate-ticket-scale-pulse';

function TicketCtaButton({
  useDayPicker,
  ticketLink,
  ticketButtonText,
  onOpenDayPicker,
  className,
}: {
  useDayPicker: boolean;
  ticketLink: string;
  ticketButtonText: string;
  onOpenDayPicker: () => void;
  className?: string;
}) {
  if (useDayPicker) {
    return (
      <Button
        className={cn(TICKET_CTA_CLASSES, className)}
        size="lg"
        onClick={onOpenDayPicker}
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        {ticketButtonText}
      </Button>
    );
  }
  return (
    <Button asChild className={cn(TICKET_CTA_CLASSES, className)} size="lg">
      <a href={safeExternalUrl(ticketLink)} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="w-4 h-4 mr-2" />
        {ticketButtonText}
      </a>
    </Button>
  );
}

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
  schedule?: unknown;
  description: string;
  image_url: string;
  ticket_link: string;
  vip_link: string;
  cta_type?: string | null;
  pix_button_enabled?: boolean;
  tickets_per_day?: boolean;
  blog_post_id: string | null;
  views: number;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
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
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Barra de CTA fixa (mobile): aparece quando o botão principal do card
  // inline sai da viewport, pra manter a compra sempre a um toque de distância.
  const primaryCtaRef = useRef<HTMLDivElement>(null);
  const [primaryCtaVisible, setPrimaryCtaVisible] = useState(true);

  // Main event query (com fallback para slug antigo via event_slug_redirects)
  const {
    data: event,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['event-detail', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;

      // Fase 6.2: se o evento existe mas foi inativado por mesclagem, segue p/ o principal.
      if (data && data.status === 'merged_inactive' && data.merged_into_id) {
        const { data: target, error: targetErr } = await supabase
          .from('events')
          .select('*')
          .eq('id', data.merged_into_id)
          .maybeSingle();
        if (targetErr) throw targetErr;
        if (target) return target as Event | null;
      }
      if (data) return data as Event | null;

      // Fallback: slug antigo (evento mesclado em festival)
      const { data: redir } = await supabase
        .from('event_slug_redirects')
        .select('event_id')
        .eq('old_slug', slug)
        .maybeSingle();
      if (!redir?.event_id) return null;

      const { data: target, error: targetErr } = await supabase
        .from('events')
        .select('*')
        .eq('id', redir.event_id)
        .maybeSingle();
      if (targetErr) throw targetErr;
      return target as Event | null;
    },
    enabled: !!slug,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Se chegou via slug antigo, redireciona para a URL nova (preserva SEO)
  useEffect(() => {
    if (event && slug && event.slug !== slug) {
      navigate(`/eventos/${event.slug}`, { replace: true });
    }
  }, [event, slug, navigate]);

  useEffect(() => {
    const node = primaryCtaRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPrimaryCtaVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [event?.id]);

  // Related blog post query
  const { data: relatedPost } = useQuery({
    queryKey: ['event-related-post', event?.blog_post_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, image_url, category, published_at')
        .eq('id', event!.blog_post_id!)
        .eq('published', true)
        .maybeSingle();
      return data as BlogPost | null;
    },
    enabled: !!event?.blog_post_id,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Related events query
  const { data: relatedEvents = [] } = useQuery({
    queryKey: ['event-related-events', event?.id, event?.genres],
    queryFn: async () => {
      const { data } = await supabase
        .from('events')
        .select(EVENT_PUBLIC_FIELDS)
        .eq('status', 'active')
        .overlaps('genres', event!.genres)
        .neq('id', event!.id)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(5);

      if (!data) return [];
      const now = new Date();
      return (data as unknown as Event[])
        .filter((e) => {
          const eventDateTime = parseLocalDateTime(e.date, e.time);
          return addHours(eventDateTime, 24) > now;
        })
        .slice(0, 3);
    },
    enabled: !!event?.id && !!event?.genres?.length,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Track view
  useEffect(() => {
    if (event?.id) {
      supabase.functions
        .invoke('track-view', { body: { eventId: event.id } })
        .catch((err) => console.error('Error tracking event view:', err));
    }
  }, [event?.id]);

  // Redirect if not found
  useEffect(() => {
    if (!isLoading && !event && !error) {
      navigate('/eventos');
    }
  }, [isLoading, event, error, navigate]);

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return 'Horário a confirmar';
    return timeStr.slice(0, 5);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div id="main-content" className="pt-20 container mx-auto px-4">
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

  const ticketCardTitle = getEventCtaCardTitle(event.cta_type);
  const ticketButtonText = getEventCtaButtonLabel(event.cta_type);
  const currentUrl = `https://mdaccula.com/eventos/${event.slug}`;

  // Fase 5: quando evento é multi-dia e admin marcou "um link por dia",
  // o botão Comprar Ingresso abre modal de seleção em vez de ir direto ao ticket_link.
  const useDayPicker =
    event.tickets_per_day === true && !!event.end_date && event.end_date !== event.date;

  // Botão Pix sem taxa: reaproveita o número do WhatsApp do vip_link, trocando a mensagem.
  const pixWhatsAppLink = event.pix_button_enabled
    ? buildPixWhatsAppLink(event.vip_link, event.title)
    : null;

  return (
    <>
      <SEOHead
        title={event.title}
        description={
          event.description ||
          `${event.title} acontece em ${formatEventDateRange(event.date, event.end_date)} no ${event.venue}, ${event.location_city} - ${event.location_state}`
        }
        keywords={event.genres ?? []}
        image={event.image_url || undefined}
        url={currentUrl}
      />
      <StructuredData
        type="event"
        data={{
          title: event.title,
          description: event.description,
          date: event.date,
          end_date: event.end_date,
          time: event.time,
          end_time: event.end_time,
          venue: event.venue,
          location_city: event.location_city,
          location_state: event.location_state,
          image_url: getOptimizedImageUrl(event.image_url) || undefined,
          ticket_link: event.ticket_link,
          lineup: event.lineup,
        }}
      />

      <div className="relative z-0 min-h-screen bg-background">
        <SoundWaveBackground />
        <Navigation />

        <main id="main-content" className="pt-20 pb-16">
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
            <Button variant="ghost" onClick={() => navigate('/eventos')} className="mb-6">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Voltar para eventos
            </Button>

            {/* Hero Image */}
            {event.image_url && (
              <div className="relative w-full h-[40vh] sm:h-[50vh] md:h-[60vh] rounded-xl overflow-hidden mb-6 sm:mb-8 shadow-lg bg-muted/20">
                <img
                  src={getThumbnailUrl(event.image_url) || getOptimizedImageUrl(event.image_url)}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
                  onError={(e) => {
                    // fundo é desfocado — thumb pode não existir (imagem antiga), full resolve visualmente igual
                    const full = getOptimizedImageUrl(event.image_url);
                    if (e.currentTarget.src !== full) e.currentTarget.src = full;
                  }}
                />
                <img
                  src={getOptimizedImageUrl(event.image_url)}
                  srcSet={`${getMediumUrl(event.image_url)} 800w, ${getOptimizedImageUrl(event.image_url)} 1920w`}
                  sizes="100vw"
                  alt={event.title}
                  className="relative w-full h-full object-contain"
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget;
                    // variante medium pode não existir (imagem antiga) -> tira o srcset e força a full
                    if (img.srcset) {
                      img.removeAttribute('srcset');
                      img.src = getOptimizedImageUrl(event.image_url);
                      return;
                    }
                    handleImageFallback(e);
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                {/* Title & Genre */}
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 leading-tight break-words text-center sm:text-left">
                    {event.title}
                  </h1>
                  {event.subtitle && (
                    <p
                      data-testid="event-subtitle"
                      className="text-base sm:text-lg md:text-xl text-white font-medium italic mb-4 break-words text-center sm:text-left underline decoration-yellow-400 decoration-2 underline-offset-4"
                    >
                      {event.subtitle}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    {event.genres && event.genres.length > 0 ? (
                      event.genres.map((genre, index) => (
                        <Badge
                          key={index}
                          className="bg-primary/20 text-primary border-primary/30 text-sm sm:text-base px-3 sm:px-4 py-1"
                        >
                          🎵 {genre}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline">Gênero não especificado</Badge>
                    )}
                  </div>
                  <div className="mt-4 flex justify-center sm:justify-start">
                    <EventCountdown date={event.date} time={event.time} end_date={event.end_date} />
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
                        <div ref={primaryCtaRef}>
                          <TicketCtaButton
                            useDayPicker={useDayPicker}
                            ticketLink={event.ticket_link}
                            ticketButtonText={ticketButtonText}
                            onOpenDayPicker={() => setDayPickerOpen(true)}
                          />
                        </div>
                      )}
                      {pixWhatsAppLink && (
                        <Button
                          asChild
                          className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white hover:opacity-90"
                          size="lg"
                        >
                          <a href={pixWhatsAppLink} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Comprar Sem Taxa via Pix
                          </a>
                        </Button>
                      )}
                      {event.vip_link && (
                        <Button variant="secondary" asChild className="w-full" size="lg">
                          <a
                            href={safeExternalUrl(event.vip_link)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
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
                        <p className="text-muted-foreground capitalize">
                          {formatEventDateRange(event.date, event.end_date)}
                        </p>
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

                {/* Mapa da localização + botão Como chegar */}
                {event.venue && event.location_city && (
                  <EventLocationMap
                    eventId={event.id}
                    venue={event.venue}
                    city={event.location_city}
                    state={event.location_state}
                    latitude={event.latitude}
                    longitude={event.longitude}
                  />
                )}

                {/* Programação por dia (festival) ou Line-up único */}
                {(() => {
                  const schedule = parseSchedule(event.schedule);
                  if (schedule && schedule.length > 1) {
                    return (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Programação por dia
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {schedule.map((day) => {
                            const dayLineup =
                              day.lineup && day.lineup.length > 0
                                ? normalizeLineup(day.lineup)
                                : normalizeLineup(event.lineup);
                            const dayLabel = parseLocalDate(day.date).toLocaleDateString('pt-BR', {
                              weekday: 'long',
                              day: '2-digit',
                              month: 'long',
                            });
                            return (
                              <div
                                key={day.date}
                                className="border-l-2 border-primary pl-4 space-y-2"
                              >
                                <div className="flex flex-wrap items-baseline gap-2">
                                  <p className="font-semibold capitalize">{dayLabel}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {day.time ? day.time.slice(0, 5) : 'Horário a confirmar'}
                                    {day.end_time ? ` – ${day.end_time.slice(0, 5)}` : ''}
                                  </p>
                                </div>
                                {dayLineup.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {dayLineup.map((artist, i) => (
                                      <motion.span
                                        key={i}
                                        initial={
                                          prefersReducedMotion ? undefined : { opacity: 0, y: 8 }
                                        }
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{
                                          duration: 0.3,
                                          delay: Math.min(i, 10) * 0.04,
                                          ease: 'easeOut',
                                        }}
                                      >
                                        <Badge
                                          variant="outline"
                                          className="text-sm px-3 py-1 leading-relaxed whitespace-normal break-words max-w-full"
                                        >
                                          {artist}
                                        </Badge>
                                      </motion.span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">
                                    Line-up a ser anunciado
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    );
                  }
                  if (event.lineup && event.lineup.length > 0) {
                    const cleanLineup = normalizeLineup(event.lineup);
                    return (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Line-up
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2.5">
                            {cleanLineup.map((artist, index) => (
                              <motion.span
                                key={index}
                                initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{
                                  duration: 0.3,
                                  delay: Math.min(index, 10) * 0.04,
                                  ease: 'easeOut',
                                }}
                              >
                                <Badge
                                  variant="outline"
                                  className="text-sm md:text-base px-3.5 py-1.5 leading-relaxed whitespace-normal break-words max-w-full"
                                >
                                  {artist}
                                </Badge>
                              </motion.span>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }
                  return null;
                })()}

                {/* Description */}
                {event.description && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Sobre o Evento</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {event.description}
                      </p>
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
                                src={getThumbnailUrl(relatedPost.image_url)}
                                alt={relatedPost.title}
                                className="w-full h-full object-contain"
                                loading="lazy"
                                decoding="async"
                                onError={(e) =>
                                  handleThumbImageFallback(
                                    e,
                                    getOptimizedImageUrl(relatedPost.image_url)
                                  )
                                }
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
                        <TicketCtaButton
                          useDayPicker={useDayPicker}
                          ticketLink={event.ticket_link}
                          ticketButtonText={ticketButtonText}
                          onOpenDayPicker={() => setDayPickerOpen(true)}
                        />
                      )}
                      {pixWhatsAppLink && (
                        <Button
                          asChild
                          className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white hover:opacity-90"
                          size="lg"
                        >
                          <a href={pixWhatsAppLink} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Comprar Sem Taxa via Pix
                          </a>
                        </Button>
                      )}
                      {event.vip_link && (
                        <Button variant="secondary" asChild className="w-full" size="lg">
                          <a
                            href={safeExternalUrl(event.vip_link)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
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
                      description={
                        event.description ||
                        `${(event.genres ?? []).join(', ') || 'Música eletrônica'} - ${event.venue ?? ''}`
                      }
                    />
                  </CardContent>
                </Card>

                {/* Related Events */}
                {relatedEvents.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Eventos Similares</CardTitle>
                      <CardDescription>
                        Outros eventos de {(event.genres ?? []).join(', ') || 'música eletrônica'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {relatedEvents.map((relatedEvent) => (
                        <Link
                          key={relatedEvent.id}
                          to={`/eventos/${relatedEvent.slug}`}
                          className="block group"
                        >
                          <SpotlightCard className="rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex gap-3 p-3">
                              {relatedEvent.image_url && (
                                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                  <img
                                    src={getThumbnailUrl(relatedEvent.image_url)}
                                    alt={relatedEvent.title}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) =>
                                      handleThumbImageFallback(
                                        e,
                                        getOptimizedImageUrl(relatedEvent.image_url)
                                      )
                                    }
                                  />
                                </div>
                              )}
                              <div className="min-w-0">
                                <h4 className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                                  {relatedEvent.title}
                                </h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {parseLocalDate(relatedEvent.date).toLocaleDateString('pt-BR')} •{' '}
                                  {relatedEvent.venue}
                                </p>
                              </div>
                            </div>
                          </SpotlightCard>
                        </Link>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
            {/* Reserva espaço pra barra fixa mobile não cobrir o último conteúdo */}
            {event.ticket_link && <div className="h-20 lg:hidden" aria-hidden="true" />}
          </div>
        </main>

        <Footer />

        {/* Barra de CTA fixa (mobile): reforça a compra enquanto o usuário rola a página */}
        {event.ticket_link && (
          <div
            className={cn(
              'lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur transition-transform duration-300',
              primaryCtaVisible ? 'translate-y-full' : 'translate-y-0'
            )}
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            <TicketCtaButton
              useDayPicker={useDayPicker}
              ticketLink={event.ticket_link}
              ticketButtonText={ticketButtonText}
              onOpenDayPicker={() => setDayPickerOpen(true)}
            />
          </div>
        )}
      </div>

      {useDayPicker && (
        <TicketDayPickerModal
          open={dayPickerOpen}
          onOpenChange={setDayPickerOpen}
          eventId={event.id}
          eventTitle={event.title}
          schedule={event.schedule}
          fallbackTicketLink={event.ticket_link}
        />
      )}
    </>
  );
};

export default EventDetail;
