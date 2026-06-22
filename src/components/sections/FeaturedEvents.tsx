import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { OptimizedImage } from "@/components/OptimizedImage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { parseLocalDate } from "@/lib/utils";
import { formatEventDateRange } from "@/lib/dateUtils";
import { useEvents } from "@/hooks/useEvents";

const FeaturedEvents = () => {
  const { events, isLoading, isError } = useEvents();
  
  // Pegar apenas os 3 primeiros do hook compartilhado
  const featuredEvents = events.slice(0, 3);

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

  if (isError) {
    return (
      <section className="py-12 bg-darker-surface">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">Erro ao carregar eventos</p>
        </div>
      </section>
    );
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

          {featuredEvents.length === 0 ? (
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
              {featuredEvents.map((event, index) => (
                <Card key={event.id} className="card-hover overflow-hidden">
                  <div className="relative aspect-video overflow-hidden">
                    <OptimizedImage
                      src={event.image_url || '/placeholder.svg'}
                      alt={event.title ?? 'Evento'}
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
                          {formatEventDateRange(event.date, (event as any).end_date)} - {event.time}
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
