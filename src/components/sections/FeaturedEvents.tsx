import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { OptimizedImage } from "@/components/OptimizedImage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { parseLocalDate } from "@/lib/utils";
import { isEventVisible } from "@/lib/eventDateHelper";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const FeaturedEvents = () => {
  const { settings } = useSiteSettings();
  
  const { data: events, isLoading, error } = useQuery({
    queryKey: ['featured-events', settings?.event_grace_hours, settings?.timezone_offset],
    queryFn: async () => {
      const graceHours = parseInt(settings?.event_grace_hours || "6");
      const timezoneOffset = parseInt(settings?.timezone_offset || "-3");
      
      // Filter server-side: only future/active events
      const today = new Date();
      today.setDate(today.getDate() - 1); // 1 day grace
      const dateFilter = today.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('events')
        .select('id, title, subtitle, slug, venue, location_city, location_state, date, time, end_time, genres, lineup, ticket_link, vip_link, image_url, views')
        .gte('date', dateFilter)
        .order('date', { ascending: true })
        .limit(10);

      if (error) throw error;
      
      // Filtrar eventos usando a nova lógica de visibilidade
      const visibleEvents = (data || []).filter(event => 
        isEventVisible(
          { date: event.date, time: event.time, end_time: event.end_time },
          { graceHours, timezoneOffset }
        )
      );
      
      // Retornar apenas os 3 primeiros após filtrar
      return visibleEvents.slice(0, 3);
    },
    enabled: !!settings, // Só executa quando settings estiver carregado
  });

  if (isLoading) {
    return (
      <section className="py-12 bg-darker-surface">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 hero-text">Próximos Eventos</h2>
            <p className="text-xl text-muted-foreground">Os melhores eventos de música eletrônica</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="card-hover overflow-hidden">
                <Skeleton className="h-64 w-full" />
                <CardContent className="p-6 space-y-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-12 bg-darker-surface">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">Erro ao carregar eventos</p>
        </div>
      </section>
    );
  }

  // Aguarda dados carregarem
  if (!events) {
    return null;
  }

  return (
    <ErrorBoundary>
      <section id="proximos-eventos" className="py-12 bg-darker-surface">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 hero-text">
              Próximos Eventos
            </h2>
            <p className="text-xl text-muted-foreground">
              Os melhores eventos de música eletrônica
            </p>
          </div>

          {events.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                Nenhum evento próximo no momento. Fique ligado para novidades!
              </p>
              <Button asChild className="mt-6">
                <Link to="/eventos">Ver Todos os Eventos</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {events.map((event, index) => (
                <Card key={event.id} className="card-hover overflow-hidden">
                  <div className="relative aspect-video overflow-hidden">
                    <OptimizedImage
                      src={event.image_url || '/placeholder.svg'}
                      alt={event.title}
                      className="w-full h-full"
                      objectFit="contain"
                      priority={index === 0}
                    />
                    <div className="absolute top-4 right-4 flex flex-wrap gap-1 justify-end">
                      {event.genres && event.genres.length > 0 && event.genres.slice(0, 2).map((genre, idx) => (
                        <span key={idx} className="bg-primary text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold">
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>

                  <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-primary line-clamp-2">{event.title}</h3>

                    <div className="space-y-2 text-sm sm:text-base text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">
                          {parseLocalDate(event.date).toLocaleDateString('pt-BR')} - {event.time}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{event.venue}</span>
                      </div>
                      {event.lineup && event.lineup.length > 0 && (
                        <div className="flex items-start gap-2">
                          <Users className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{event.lineup.join(', ')}</span>
                        </div>
                      )}
                    </div>

                    <Button className="w-full min-h-[44px] text-base" asChild>
                      <a href={event.ticket_link || '#'} target="_blank" rel="noopener noreferrer">
                        Comprar Ingressos
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </ErrorBoundary>
  );
};

export default FeaturedEvents;
