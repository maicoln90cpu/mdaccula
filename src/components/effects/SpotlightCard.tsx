import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
}

/** Wraps content in a radial glow that follows the cursor on hover (desktop-only via CSS :hover, no-ops on touch). */
export const SpotlightCard = ({ children, className }: SpotlightCardProps) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const background = useMotionTemplate`radial-gradient(240px circle at ${mouseX}px ${mouseY}px, hsl(var(--primary) / 0.15), transparent 80%)`;

  return (
    <div className={cn('group relative overflow-hidden', className)} onMouseMove={handleMouseMove}>
      <motion.div
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
};
