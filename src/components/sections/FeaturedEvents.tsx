import { Button } from "@/components/ui/button";
import { Calendar, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { OptimizedImage } from "@/components/OptimizedImage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { formatEventDateRange } from "@/lib/dateUtils";
import { useEvents } from "@/hooks/useEvents";
import { StructuredData } from "@/components/StructuredData";
import { useScrollReveal } from "@/hooks";
import { cn } from "@/lib";
import type { Event } from "@/types";
import SectionHeading from "@/components/sections/SectionHeading";

const EventCard = ({ event, index }: { event: Event; index: number }) => {
  const { ref, isVisible } = useScrollReveal<HTMLElement>();

  return (
    <article
      ref={ref}
      className={cn(
        "group rounded-lg overflow-hidden border border-border bg-card transition-all duration-500",
        "hover:-translate-y-2 hover:shadow-[0_24px_50px_hsl(220_25%_0%/0.35),0_0_32px_hsl(var(--primary)/0.25)] hover:border-primary/40",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <StructuredData
        type="event"
        data={{
          title: event.title,
          description: event.description ?? undefined,
          date: event.date,
          end_date: event.end_date,
          time: event.time,
          end_time: event.end_time,
          venue: event.venue,
          location_city: event.location_city,
          location_state: event.location_state,
          image_url: event.image_url ?? undefined,
          ticket_link: event.ticket_link ?? undefined,
          lineup: event.lineup ?? undefined,
        }}
      />

      <div className="relative aspect-square overflow-hidden">
        <OptimizedImage
          src={event.image_url || "/placeholder.svg"}
          alt={event.title ?? "Evento"}
          className="w-full h-full transition-transform duration-500 group-hover:scale-105"
          objectFit="cover"
          priority={index === 0}
        />
        {event.genres && event.genres.length > 0 && (
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {event.genres.slice(0, 1).map((genre) => (
              <span
                key={genre}
                className="text-[0.65rem] font-mono font-bold uppercase tracking-wide bg-accent text-accent-foreground px-2 py-0.5 rounded-full"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-display font-bold uppercase text-sm leading-tight mb-2 line-clamp-2">
          {event.title ?? "Evento sem título"}
        </h3>

        <div className="space-y-1 text-xs font-mono text-muted-foreground mb-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{formatEventDateRange(event.date, event.end_date)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{event.location_city}</span>
          </div>
        </div>

        <Button size="sm" className="w-full min-h-[40px] text-sm" asChild>
          <a href={event.ticket_link || "#"} target="_blank" rel="noopener noreferrer">
            Comprar Ingressos
          </a>
        </Button>
      </div>
    </article>
  );
};

const FeaturedEvents = () => {
  const { events, isLoading, isError } = useEvents();
  const featuredEvents = events.slice(0, 8);

  if (isLoading) {
    return (
      <section className="py-16 sm:py-20 bg-darker-surface">
        <div className="container mx-auto px-4">
          <SectionHeading title="Próximos Eventos" viewAllHref="/eventos" viewAllLabel="Ver todos" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="rounded-lg overflow-hidden border border-border bg-card">
                <Skeleton className="aspect-square w-full" />
                <div className="p-3 space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="py-16 bg-darker-surface">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">Erro ao carregar eventos</p>
        </div>
      </section>
    );
  }

  return (
    <ErrorBoundary>
      <section id="proximos-eventos" className="py-16 sm:py-20 bg-darker-surface">
        <div className="container mx-auto px-4">
          <SectionHeading title="Próximos Eventos" viewAllHref="/eventos" viewAllLabel="Ver todos" />

          {featuredEvents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg mb-6">
                Nenhum evento próximo no momento. Fique ligado para novidades!
              </p>
              <Button asChild>
                <Link to="/eventos">Ver Todos os Eventos</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
              {featuredEvents.map((event, index) => (
                <EventCard key={event.id} event={event} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>
    </ErrorBoundary>
  );
};

export default FeaturedEvents;
