import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { OptimizedImage } from "@/components/OptimizedImage";
import { useEvents } from "@/hooks/useEvents";
import { formatEventDateRange } from "@/lib/dateUtils";
import { Skeleton } from "@/components/ui/skeleton";

const FLYER_LAYOUT = [
  { top: "0%", left: "12%", rotate: -6, depth: 10 },
  { top: "18%", left: "42%", rotate: 5, depth: 16 },
  { top: "42%", left: "2%", rotate: 3, depth: 6 },
];

const FlyerMural = () => {
  const { events, isLoading } = useEvents();
  const flyers = events.slice(0, 3);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const container = containerRef.current;
    if (!canHover || prefersReducedMotion || !container) return;

    const handleMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      cardRefs.current.forEach((card, i) => {
        if (!card) return;
        const depth = FLYER_LAYOUT[i]?.depth ?? 8;
        card.style.setProperty("--px", `${(relX * depth).toFixed(2)}px`);
        card.style.setProperty("--py", `${(relY * depth).toFixed(2)}px`);
      });
    };
    const handleLeave = () => {
      cardRefs.current.forEach((card) => {
        card?.style.setProperty("--px", "0px");
        card?.style.setProperty("--py", "0px");
      });
    };

    container.addEventListener("pointermove", handleMove);
    container.addEventListener("pointerleave", handleLeave);
    return () => {
      container.removeEventListener("pointermove", handleMove);
      container.removeEventListener("pointerleave", handleLeave);
    };
  }, [flyers.length]);

  return (
    <div
      ref={containerRef}
      className="relative hidden lg:block w-[26rem] h-[26rem] shrink-0"
      aria-hidden={flyers.length === 0}
    >
      {isLoading &&
        FLYER_LAYOUT.map((pos, i) => (
          <Skeleton
            key={i}
            className="absolute w-64 h-56 rounded-md"
            style={{ top: pos.top, left: pos.left, transform: `rotate(${pos.rotate}deg)` }}
          />
        ))}

      {!isLoading &&
        flyers.map((event, i) => {
          const pos = FLYER_LAYOUT[i];
          return (
            <article
              key={event.id}
              ref={(el) => (cardRefs.current[i] = el)}
              className="glass-card absolute w-64"
              style={{
                top: pos.top,
                left: pos.left,
                zIndex: 10 + i,
                transform: `rotate(${pos.rotate}deg) translate(var(--px, 0px), var(--py, 0px))`,
              }}
            >
              <div className="relative h-36 overflow-hidden">
                <OptimizedImage
                  src={event.image_url || "/placeholder.svg"}
                  alt=""
                  className="w-full h-full"
                  objectFit="cover"
                />
                {event.genres?.[0] && (
                  <span className="absolute top-2 left-2 text-[0.65rem] font-mono uppercase tracking-wide font-bold bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                    {event.genres[0]}
                  </span>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-display font-bold uppercase text-sm leading-tight mb-1 line-clamp-1">
                  {event.title}
                </h3>
                <div className="flex justify-between text-[0.7rem] font-mono text-muted-foreground">
                  <span>{formatEventDateRange(event.date, event.end_date)}</span>
                  <span className="truncate ml-2">{event.location_city}</span>
                </div>
              </div>
            </article>
          );
        })}
    </div>
  );
};

const Hero = () => {
  return (
    <section className="relative overflow-hidden py-14 sm:py-20">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 20% 10%, hsl(var(--primary) / 0.18), transparent 60%), radial-gradient(ellipse 50% 50% at 85% 30%, hsl(var(--accent) / 0.14), transparent 60%)",
        }}
      />

      <div className="relative container mx-auto px-4 grid lg:grid-cols-[1fr_auto] items-center gap-10">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-secondary-glow bg-secondary/10 border border-secondary/40 px-3 py-1.5 rounded-full mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary-glow shadow-[0_0_8px_hsl(var(--secondary-glow))]" />
            Cena eletrônica do Brasil, ao vivo
          </span>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 logo-gradient animate-logo-pulse leading-tight">
            MDAccula
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed mb-8">
            Todo fim de semana tem flyer novo na parede. Aqui embaixo estão os que valem a pena —
            escolhido, datado e com ingresso a um clique.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="btn-neon text-base px-8 py-4" asChild>
              <Link to="/eventos">
                <span className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  <span>Ver todos os eventos</span>
                </span>
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="text-base px-8 py-4 border-primary/50 hover:border-primary" asChild>
              <Link to="/quem-somos">
                <MapPin className="w-5 h-5 mr-2" />
                Quem somos
              </Link>
            </Button>
          </div>
        </div>

        <FlyerMural />
      </div>
    </section>
  );
};

export default Hero;
