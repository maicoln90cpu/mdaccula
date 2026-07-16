import { motion, useReducedMotion } from "framer-motion";

interface Blob {
  color: string;
  size: number;
  top: string;
  left: string;
  duration: number;
}

const BLOBS: Blob[] = [
  { color: "hsl(var(--neon-purple) / 0.22)", size: 420, top: "-12%", left: "0%", duration: 18 },
  { color: "hsl(var(--neon-blue) / 0.16)", size: 380, top: "5%", left: "68%", duration: 22 },
  { color: "hsl(var(--neon-pink) / 0.14)", size: 320, top: "48%", left: "28%", duration: 26 },
];

/** Ambient drifting glow behind hero content, built from the existing neon design tokens. */
const AuroraBackground = () => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {BLOBS.map((blob, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{
            width: blob.size,
            height: blob.size,
            top: blob.top,
            left: blob.left,
            background: blob.color,
          }}
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  x: [0, 40, -20, 0],
                  y: [0, -30, 20, 0],
                  scale: [1, 1.15, 0.95, 1],
                }
          }
          transition={{ duration: blob.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
};

export default AuroraBackground;
