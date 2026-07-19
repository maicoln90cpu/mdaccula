import { Button } from '@/components/ui/button';
import { Calendar, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { OptimizedImage } from '@/components/OptimizedImage';
import { useEvents } from '@/hooks/useEvents';
import { formatEventDateRange } from '@/lib/dateUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { useMuralParallax } from '@/hooks/useTiltParallax';
import { useMagneticHover } from '@/hooks/useMagneticHover';
import AuroraBackground from '@/components/effects/AuroraBackground';

const FLYER_LAYOUT = [
  { top: '0%', left: '12%', rotate: -6, depth: 10 },
  { top: '18%', left: '42%', rotate: 5, depth: 16 },
  { top: '42%', left: '2%', rotate: 3, depth: 6 },
] as const;

const FlyerMural = () => {
  const { events, isLoading } = useEvents();
  const flyers = events.slice(0, 3);
  const { containerRef, items, onPointerMove, onPointerLeave } = useMuralParallax(
    FLYER_LAYOUT.map((pos) => pos.depth) as [number, number, number]
  );

  return (
    <div
      ref={containerRef}
      className="relative hidden lg:block w-[26rem] h-[26rem] shrink-0"
      aria-hidden={flyers.length === 0}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
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
          const { x, y } = items[i];
          return (
            <motion.article
              key={event.id}
              className="glass-card absolute w-64"
              style={{
                top: pos.top,
                left: pos.left,
                zIndex: 10 + i,
                rotate: pos.rotate,
                x,
                y,
              }}
            >
              <div className="relative h-36 overflow-hidden">
                <OptimizedImage
                  src={event.image_url || '/placeholder.svg'}
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
            </motion.article>
          );
        })}
    </div>
  );
};

const Hero = () => {
  const magnetic = useMagneticHover<HTMLSpanElement>(10);

  return (
    <section className="relative overflow-hidden py-14 sm:py-20">
      <AuroraBackground />

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
            <motion.span
              ref={magnetic.ref}
              className="inline-block"
              style={{ x: magnetic.x, y: magnetic.y }}
              onPointerMove={magnetic.onPointerMove}
              onPointerLeave={magnetic.onPointerLeave}
            >
              <Button size="lg" className="btn-neon text-base px-8 py-4" asChild>
                <Link to="/eventos">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    <span>Ver todos os eventos</span>
                  </span>
                </Link>
              </Button>
            </motion.span>
            <Button
              variant="outline"
              size="lg"
              className="text-base px-8 py-4 border-primary/50 hover:border-primary"
              asChild
            >
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
