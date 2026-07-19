import { useRef } from 'react';
import { useMotionValue, useSpring, useReducedMotion, type MotionValue } from 'framer-motion';

const SPRING = { stiffness: 200, damping: 20, mass: 0.3 };

export interface MagneticHoverHandle<T extends HTMLElement> {
  ref: React.RefObject<T>;
  x: MotionValue<number>;
  y: MotionValue<number>;
  onPointerMove: (e: React.PointerEvent<T>) => void;
  onPointerLeave: () => void;
}

/** Pulls the wrapped element a few pixels toward the cursor (desktop-only, respects prefers-reduced-motion). */
export function useMagneticHover<T extends HTMLElement = HTMLElement>(
  strength = 10
): MagneticHoverHandle<T> {
  const ref = useRef<T>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, SPRING);
  const y = useSpring(my, SPRING);
  const prefersReducedMotion = useReducedMotion();

  const onPointerMove = (e: React.PointerEvent<T>) => {
    if (prefersReducedMotion || e.pointerType !== 'mouse' || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    mx.set(relX * strength);
    my.set(relY * strength);
  };

  const onPointerLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return { ref, x, y, onPointerMove, onPointerLeave };
}
