import { useEffect, useRef, useState } from 'react';
import { TicketDayPickerModal } from '@/components/events/TicketDayPickerModal';
import { EventCountdown } from '@/components/events/EventCountdown';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/ui/navigation';
import Footer from '@/components/ui/footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { addHours } from 'date-fns';
import { cn } from '@/lib';
import { parseLocalDateTime, formatEventDateRange } from '@/lib/dateUtils';
import { EVENT_PUBLIC_FIELDS } from '@/lib/eventSelectFields';

// EVENT_PUBLIC_FIELDS exclui colunas `merged_*` de propósito (não são
// exibidas em listas/cards). A página de detalhe é a única consumidora que
// PRECISA de `status`/`merged_into_id` para redirecionar eventos mesclados
// para o evento principal — por isso estende localmente em vez de mudar a
// constante compartilhada.
const EVENT_DETAIL_FIELDS = `${EVENT_PUBLIC_FIELDS}, merged_into_id`;
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
import { ChevronLeft } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { getOptimizedImageUrl } from '@/lib/imageUtils';
import { StructuredData } from '@/components/StructuredData';
import { EventLocationMap } from '@/components/events/EventLocationMap';
import { HeroImage } from '@/components/eventDetail/HeroImage';
import { TicketCard } from '@/components/eventDetail/TicketCard';
import { TicketCtaButton } from '@/components/eventDetail/TicketCtaButton';
import { EventDetailsCard } from '@/components/eventDetail/EventDetailsCard';
import { ScheduleOrLineup } from '@/components/eventDetail/ScheduleOrLineup';
import { RelatedBlogPostCard } from '@/components/eventDetail/RelatedBlogPostCard';
import { RelatedEventsCard } from '@/components/eventDetail/RelatedEventsCard';
import type { EventDetailData, RelatedBlogPost } from '@/components/eventDetail/types';

const EventDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [dayPickerOpen, setDayPickerOpen] = useState(false);

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
        .select(EVENT_DETAIL_FIELDS)
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;

      // Fase 6.2: se o evento existe mas foi inativado por mesclagem, segue p/ o principal.
      if (data && data.status === 'merged_inactive' && data.merged_into_id) {
        const { data: target, error: targetErr } = await supabase
          .from('events')
          .select(EVENT_DETAIL_FIELDS)
          .eq('id', data.merged_into_id)
          .maybeSingle();
        if (targetErr) throw targetErr;
        if (target) return target as EventDetailData | null;
      }
      if (data) return data as EventDetailData | null;

      // Fallback: slug antigo (evento mesclado em festival)
      const { data: redir } = await supabase
        .from('event_slug_redirects')
        .select('event_id')
        .eq('old_slug', slug)
        .maybeSingle();
      if (!redir?.event_id) return null;

      const { data: target, error: targetErr } = await supabase
        .from('events')
        .select(EVENT_DETAIL_FIELDS)
        .eq('id', redir.event_id)
        .maybeSingle();
      if (targetErr) throw targetErr;
      return target as EventDetailData | null;
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
      return data as RelatedBlogPost | null;
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
      return (data as unknown as EventDetailData[])
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

  const openDayPicker = () => setDayPickerOpen(true);

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

            <HeroImage imageUrl={event.image_url} title={event.title} />

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
                {(event.ticket_link || event.vip_link || useDayPicker) && (
                  <TicketCard
                    ref={primaryCtaRef}
                    className="lg:hidden"
                    cardTitle={ticketCardTitle}
                    ticketLink={event.ticket_link}
                    ticketButtonText={ticketButtonText}
                    useDayPicker={useDayPicker}
                    onOpenDayPicker={openDayPicker}
                    pixWhatsAppLink={pixWhatsAppLink}
                    vipLink={event.vip_link}
                  />
                )}

                <EventDetailsCard
                  date={event.date}
                  endDate={event.end_date}
                  time={event.time}
                  endTime={event.end_time}
                  venue={event.venue}
                  city={event.location_city}
                  state={event.location_state}
                />

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

                <ScheduleOrLineup schedule={event.schedule} lineup={event.lineup} />

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

                {relatedPost && <RelatedBlogPostCard post={relatedPost} />}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Ticket Buttons - Desktop only */}
                {(event.ticket_link || event.vip_link || useDayPicker) && (
                  <TicketCard
                    className="hidden lg:block"
                    cardTitle={ticketCardTitle}
                    ticketLink={event.ticket_link}
                    ticketButtonText={ticketButtonText}
                    useDayPicker={useDayPicker}
                    onOpenDayPicker={openDayPicker}
                    pixWhatsAppLink={pixWhatsAppLink}
                    vipLink={event.vip_link}
                  />
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

                <RelatedEventsCard events={relatedEvents} genres={event.genres} />
              </div>
            </div>
            {/* Reserva espaço pra barra fixa mobile não cobrir o último conteúdo */}
            {(event.ticket_link || useDayPicker) && (
              <div className="h-20 lg:hidden" aria-hidden="true" />
            )}
          </div>
        </main>

        <Footer />

        {/* Barra de CTA fixa (mobile): reforça a compra enquanto o usuário rola a página */}
        {(event.ticket_link || useDayPicker) && (
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
              onOpenDayPicker={openDayPicker}
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
