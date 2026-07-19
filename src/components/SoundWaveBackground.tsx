/**
 * Fundo decorativo de ondas sonoras em CSS/SVG puro — sem imagem, sem lib nova,
 * custo de banda zero. Teste isolado em EventDetail.tsx antes de considerar
 * aplicar em outras páginas (ver PENDENCIAS.MD/CHANGELOG).
 *
 * `fixed` (não `absolute`) de propósito: a página de evento é bem longa, então
 * ancorar ao fim do documento inteiro deixava as ondas escondidas lá embaixo,
 * dentro do rodapé — praticamente invisíveis na prática. Fixo ao viewport, elas
 * ficam sempre visíveis perto da base da tela, em qualquer ponto do scroll.
 */
export function SoundWaveBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <svg
        className="animate-wave-drift-slow absolute bottom-0 left-0 h-48 w-[200%] sm:h-64"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0,100 C120,150 240,50 360,100 C480,150 600,50 720,100 C840,150 960,50 1080,100 C1200,150 1320,50 1440,100 L1440,200 L0,200 Z"
          fill="hsl(var(--secondary) / 0.12)"
        />
        <path
          d="M1440,100 C1560,150 1680,50 1800,100 C1920,150 2040,50 2160,100 C2280,150 2400,50 2520,100 C2640,150 2760,50 2880,100 L2880,200 L1440,200 Z"
          fill="hsl(var(--secondary) / 0.12)"
        />
      </svg>
      <svg
        className="animate-wave-drift absolute bottom-0 left-0 h-40 w-[200%] sm:h-52"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0,120 C90,80 180,160 270,120 C360,80 450,160 540,120 C630,80 720,160 810,120 C900,80 990,160 1080,120 C1170,80 1260,160 1350,120 C1400,105 1420,110 1440,120 L1440,200 L0,200 Z"
          fill="hsl(var(--primary) / 0.15)"
        />
        <path
          d="M1440,120 C1530,80 1620,160 1710,120 C1800,80 1890,160 1980,120 C2070,80 2160,160 2250,120 C2340,80 2430,160 2520,120 C2610,80 2700,160 2790,120 C2840,105 2860,110 2880,120 L2880,200 L1440,200 Z"
          fill="hsl(var(--primary) / 0.15)"
        />
      </svg>
      <svg
        className="animate-wave-drift-fast absolute bottom-0 left-0 h-24 w-[200%] sm:h-32"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0,140 C100,110 200,170 300,140 C400,110 500,170 600,140 C700,110 800,170 900,140 C1000,110 1100,170 1200,140 C1300,110 1400,170 1440,150 L1440,200 L0,200 Z"
          fill="hsl(var(--accent) / 0.12)"
        />
        <path
          d="M1440,140 C1540,110 1640,170 1740,140 C1840,110 1940,170 2040,140 C2140,110 2240,170 2340,140 C2440,110 2540,170 2640,140 C2740,110 2840,170 2880,150 L2880,200 L1440,200 Z"
          fill="hsl(var(--accent) / 0.12)"
        />
      </svg>
    </div>
  );
}
