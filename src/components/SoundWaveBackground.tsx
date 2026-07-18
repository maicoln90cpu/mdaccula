/**
 * Fundo decorativo de ondas sonoras em CSS/SVG puro — sem imagem, sem lib nova,
 * custo de banda zero. Teste isolado em EventDetail.tsx antes de considerar
 * aplicar em outras páginas (ver PENDENCIAS.MD/CHANGELOG).
 */
export function SoundWaveBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <svg
        className="animate-wave-drift-slow absolute bottom-0 left-0 h-40 w-[200%] sm:h-56"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0,100 C120,150 240,50 360,100 C480,150 600,50 720,100 C840,150 960,50 1080,100 C1200,150 1320,50 1440,100 L1440,200 L0,200 Z"
          fill="hsl(var(--secondary) / 0.08)"
        />
        <path
          d="M1440,100 C1560,150 1680,50 1800,100 C1920,150 2040,50 2160,100 C2280,150 2400,50 2520,100 C2640,150 2760,50 2880,100 L2880,200 L1440,200 Z"
          fill="hsl(var(--secondary) / 0.08)"
        />
      </svg>
      <svg
        className="animate-wave-drift absolute bottom-0 left-0 h-32 w-[200%] sm:h-44"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0,120 C90,80 180,160 270,120 C360,80 450,160 540,120 C630,80 720,160 810,120 C900,80 990,160 1080,120 C1170,80 1260,160 1350,120 C1400,105 1420,110 1440,120 L1440,200 L0,200 Z"
          fill="hsl(var(--primary) / 0.1)"
        />
        <path
          d="M1440,120 C1530,80 1620,160 1710,120 C1800,80 1890,160 1980,120 C2070,80 2160,160 2250,120 C2340,80 2430,160 2520,120 C2610,80 2700,160 2790,120 C2840,105 2860,110 2880,120 L2880,200 L1440,200 Z"
          fill="hsl(var(--primary) / 0.1)"
        />
      </svg>
    </div>
  );
}
