import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

interface SectionHeadingProps {
  title: string;
  viewAllHref: string;
  viewAllLabel: string;
}

const SectionHeading = ({ title, viewAllHref, viewAllLabel }: SectionHeadingProps) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative flex items-baseline justify-between gap-4 flex-wrap mb-10 pb-4 border-b border-border">
      <h2 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-tight">
        {title}
      </h2>
      <Link
        to={viewAllHref}
        className="inline-flex items-center gap-1 text-sm font-mono text-primary hover:text-primary-glow transition-colors"
      >
        {viewAllLabel}
        <ArrowRight className="w-4 h-4" />
      </Link>
      <motion.span
        className="absolute left-0 -bottom-px h-0.5 w-32 max-w-[40%] origin-left"
        style={{
          background:
            'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--secondary)))',
          boxShadow: '0 0 12px hsl(var(--primary) / 0.5)',
        }}
        initial={prefersReducedMotion ? undefined : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
};

export default SectionHeading;
