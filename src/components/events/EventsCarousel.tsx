import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, Clock } from "lucide-react";
import { parseLocalDate } from "@/lib/dateUtils";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";

interface Event {
  id: string;
  title: string;
  date: string;
  end_date?: string | null;
  time: string;
  venue: string;
  location_city: string;
  location_state: string;
  image_url?: string | null;
  genres?: string[];
  slug: string;
}

interface EventsCarouselProps {
  events: Event[];
}

// Lazy loaded image component with blur placeholder
const LazyEventImage = ({ 
  src, 
  alt 
}: { 
  src: string | null | undefined; 
  alt: string;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const showGradient = !src || hasError;

  return (
    <>
      {/* Gradient fallback or placeholder while loading */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          isLoaded && !showGradient ? "opacity-0" : "opacity-100"
        }`}
        style={{
          background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)",
        }}
      />
      
      {/* Actual image with lazy loading */}
      {src && !hasError && (
        <img
          src={getOptimizedImageUrl(src)}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </>
  );
};

const EventsCarousel = ({ events }: EventsCarouselProps) => {
  const navigate = useNavigate();

  if (!events || events.length === 0) {
    return null;
  }

  const handleEventClick = (slug: string) => {
    navigate(`/eventos/${slug}`);
  };

  return (
    <div className="relative px-2">
      <Carousel
        opts={{
          align: "start",
          loop: events.length > 2,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2">
          {events.map((event) => {
            const eventDate = parseLocalDate(event.date);
            const dayOfMonth = format(eventDate, "dd", { locale: ptBR });
            const monthShort = format(eventDate, "MMM", { locale: ptBR }).toUpperCase();
            const weekDay = format(eventDate, "EEE", { locale: ptBR });
            const isFestival = !!event.end_date && event.end_date !== event.date;
            const dayEnd = isFestival ? format(parseLocalDate(event.end_date!), "dd", { locale: ptBR }) : null;

            return (
              <CarouselItem key={event.id} className="pl-2 basis-[85%] sm:basis-1/2 lg:basis-1/3">
                <div
                  onClick={() => handleEventClick(event.slug)}
                  className="relative h-48 rounded-xl overflow-hidden cursor-pointer group"
                >
                  {/* Lazy Loaded Background Image */}
                  <LazyEventImage 
                    src={event.image_url || '/placeholder.svg'} 
                    alt={event.title ?? 'Evento'} 
                  />
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  
                  {/* Date Badge */}
                  <div className="absolute top-3 left-3 bg-primary/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-center">
                    <div className="text-lg font-bold text-primary-foreground leading-none">
                      {isFestival ? `${dayOfMonth}–${dayEnd}` : dayOfMonth}
                    </div>
                    <div className="text-[10px] text-primary-foreground/80 uppercase">
                      {monthShort}
                    </div>
                  </div>
                  
                  {/* Genres */}
                  {event.genres && event.genres.length > 0 && (
                    <div className="absolute top-3 right-3">
                      <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-background/80 backdrop-blur-sm">
                        {event.genres[0]}
                      </Badge>
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1.5">
                      {event.title}
                    </h3>
                    
                    <div className="flex items-center gap-3 text-white/70 text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{weekDay}{event.time ? ` • ${event.time.slice(0, 5)}` : ''}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate max-w-[100px]">{event.venue}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        
        {events.length > 2 && (
          <>
            <CarouselPrevious className="hidden sm:flex -left-3 h-8 w-8" />
            <CarouselNext className="hidden sm:flex -right-3 h-8 w-8" />
          </>
        )}
      </Carousel>
    </div>
  );
};

export default EventsCarousel;
