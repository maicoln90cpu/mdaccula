import { useScrollReveal } from '@/hooks';
import { cn } from '@/lib';

const stats = [
  { value: '500+', label: 'Eventos Promovidos' },
  { value: '200+', label: 'DJs Parceiros' },
  { value: '50k+', label: 'Seguidores' },
];

const StatCell = ({ value, label, delay }: { value: string; label: string; delay: number }) => {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(
        'group text-center py-8 px-6 transition-all duration-500',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-foreground transition-all duration-300 group-hover:-translate-y-1 group-hover:text-primary-glow group-hover:[text-shadow:0_0_24px_hsl(var(--primary)/0.6)]">
        {value}
      </div>
      <div className="text-sm sm:text-base text-muted-foreground mt-1">{label}</div>
    </div>
  );
};

const StatStrip = () => {
  return (
    <section className="border-y border-border bg-darker-surface" aria-label="Números da MDAccula">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {stats.map((stat, index) => (
            <StatCell key={stat.label} value={stat.value} label={stat.label} delay={index * 80} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatStrip;
