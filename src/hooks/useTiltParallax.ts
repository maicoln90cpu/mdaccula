import { useRef } from "react";
import { useMotionValue, useSpring, useReducedMotion, type MotionValue } from "framer-motion";

const SPRING = { stiffness: 150, damping: 18, mass: 0.4 };

function isMousePointer(e: React.PointerEvent): boolean {
  return e.pointerType === "mouse";
}

export interface TiltRotateHandle<T extends HTMLElement> {
  ref: React.RefObject<T>;
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  onPointerMove: (e: React.PointerEvent<T>) => void;
  onPointerLeave: () => void;
}

/** Single-element 3D tilt driven by pointer position (desktop-only, respects prefers-reduced-motion). */
export function useTiltRotate<T extends HTMLElement = HTMLDivElement>(maxDeg = 16): TiltRotateHandle<T> {
  const ref = useRef<T>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, SPRING);
  const rotateY = useSpring(ry, SPRING);
  const prefersReducedMotion = useReducedMotion();

  const onPointerMove = (e: React.PointerEvent<T>) => {
    if (prefersReducedMotion || !isMousePointer(e) || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    ry.set(relX * maxDeg);
    rx.set(relY * -maxDeg);
  };

  const onPointerLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return { ref, rotateX, rotateY, onPointerMove, onPointerLeave };
}

export interface MuralParallaxHandle {
  containerRef: React.RefObject<HTMLDivElement>;
  items: readonly [
    { x: MotionValue<number>; y: MotionValue<number> },
    { x: MotionValue<number>; y: MotionValue<number> },
    { x: MotionValue<number>; y: MotionValue<number> },
  ];
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: () => void;
}

/**
 * Shared pointer-parallax for a 3-card mural: one listener on the container distributes
 * translation to each card at its own depth. Fixed to 3 slots (matches the mural's fixed
 * layout) so hook calls stay unconditional/ordered.
 */
export function useMuralParallax(depths: readonly [number, number, number]): MuralParallaxHandle {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const x0 = useMotionValue(0);
  const y0 = useMotionValue(0);
  const x1 = useMotionValue(0);
  const y1 = useMotionValue(0);
  const x2 = useMotionValue(0);
  const y2 = useMotionValue(0);

  const items = [
    { x: useSpring(x0, SPRING), y: useSpring(y0, SPRING) },
    { x: useSpring(x1, SPRING), y: useSpring(y1, SPRING) },
    { x: useSpring(x2, SPRING), y: useSpring(y2, SPRING) },
  ] as const;

  const rawX = [x0, x1, x2];
  const rawY = [y0, y1, y2];

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !isMousePointer(e) || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    depths.forEach((depth, i) => {
      rawX[i].set(relX * depth);
      rawY[i].set(relY * depth);
    });
  };

  const onPointerLeave = () => {
    rawX.forEach((mv) => mv.set(0));
    rawY.forEach((mv) => mv.set(0));
  };

  return { containerRef, items, onPointerMove, onPointerLeave };
}
