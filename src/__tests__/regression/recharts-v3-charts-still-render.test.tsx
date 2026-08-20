import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

import { ChartContainer, ChartTooltipContent, ChartLegendContent } from '@/components/ui/chart';

/**
 * R-078 — o `recharts` 3 reescreveu o motor interno e removeu `payload`/`label`
 * dos tipos públicos de Tooltip e Legend, que o wrapper `components/ui/chart.tsx`
 * usa. Um erro nesse wrapper não quebra o build de forma óbvia: o gráfico
 * simplesmente deixa de desenhar (ou some a legenda/tooltip) nos painéis de
 * e-mail, egress e analytics. Este teste garante que barras, linhas, eixos,
 * grade, tooltip e legenda continuam sendo renderizados.
 *
 * Obs.: os gráficos são renderizados direto (sem `ChartContainer`) porque o
 * `ResponsiveContainer` mede 0x0 no jsdom e não desenharia nada.
 */
const data = [
  { name: 'Seg', enviados: 12, abertos: 5 },
  { name: 'Ter', enviados: 20, abertos: 9 },
  { name: 'Qua', enviados: 7, abertos: 3 },
];

const config = {
  enviados: { label: 'Enviados', color: 'hsl(var(--primary))' },
  abertos: { label: 'Abertos', color: 'hsl(var(--accent))' },
};

// O ResponsiveContainer do recharts mede o elemento via ResizeObserver; no
// jsdom o mock global devolve 0x0 e nada seria desenhado dentro do
// ChartContainer. Aqui devolvemos um tamanho fixo.
beforeAll(() => {
  class SizedResizeObserver {
    constructor(private cb: ResizeObserverCallback) {}
    observe(target: Element) {
      this.cb(
        [{ target, contentRect: { width: 400, height: 200 } } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver
      );
    }
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = SizedResizeObserver;
});

describe('R-078: gráficos continuam desenhando após o recharts 3', () => {
  it('renderiza barras, eixos e grade', () => {
    const { container } = render(
      <BarChart data={data} width={400} height={200}>
        <CartesianGrid />
        <XAxis dataKey="name" />
        <YAxis />
        <Bar dataKey="enviados" fill="#f0f" isAnimationActive={false} />
      </BarChart>
    );

    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelectorAll('.recharts-bar-rectangle').length).toBe(data.length);
    expect(container.querySelector('.recharts-cartesian-grid')).not.toBeNull();
    expect(container.querySelectorAll('.recharts-cartesian-axis').length).toBeGreaterThanOrEqual(2);
  });

  it('renderiza linhas', () => {
    const { container } = render(
      <LineChart data={data} width={400} height={200}>
        <XAxis dataKey="name" />
        <Line dataKey="enviados" stroke="#f0f" isAnimationActive={false} />
        <Line dataKey="abertos" stroke="#0ff" isAnimationActive={false} />
      </LineChart>
    );

    expect(container.querySelectorAll('.recharts-line-curve').length).toBe(2);
  });

  it('tooltip customizado mostra rótulo e valor', () => {
    const { container } = render(
      <ChartContainer config={config} className="h-[200px] w-[400px]">
        <ChartTooltipContent
          active
          label="Seg"
          payload={[{ dataKey: 'enviados', name: 'enviados', value: 12, color: '#f0f' }]}
        />
      </ChartContainer>
    );

    expect(container.textContent).toContain('Enviados');
    expect(container.textContent).toContain('12');
  });

  it('legenda customizada mostra o nome de cada série', () => {
    const { container } = render(
      <ChartContainer config={config} className="h-[200px] w-[400px]">
        <ChartLegendContent
          payload={[
            { value: 'enviados', dataKey: 'enviados', color: '#f0f' },
            { value: 'abertos', dataKey: 'abertos', color: '#0ff' },
          ]}
        />
      </ChartContainer>
    );

    expect(container.textContent).toContain('Enviados');
    expect(container.textContent).toContain('Abertos');
  });
});
