import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';

/**
 * R-078 — o `recharts` 3 reescreveu o motor interno e removeu `payload`/`label`
 * dos tipos públicos de Tooltip e Legend, que o wrapper `components/ui/chart.tsx`
 * usa. Um erro nesse wrapper não quebra o build de forma óbvia: o gráfico
 * simplesmente deixa de desenhar (ou some a legenda/tooltip) nos painéis de
 * e-mail, egress e analytics. Este teste garante que barras, linhas, eixos,
 * grade e legenda continuam sendo renderizados.
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

describe('R-078: gráficos continuam desenhando após o recharts 3', () => {
  it('renderiza barras, eixos e grade', () => {
    const { container } = render(
      <ChartContainer config={config} className="h-[200px] w-[400px]">
        <BarChart data={data} width={400} height={200}>
          <CartesianGrid />
          <XAxis dataKey="name" />
          <YAxis />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="enviados" fill="var(--color-enviados)" />
        </BarChart>
      </ChartContainer>
    );

    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelectorAll('.recharts-bar-rectangle').length).toBe(data.length);
    expect(container.querySelector('.recharts-cartesian-grid')).not.toBeNull();
    expect(container.querySelectorAll('.recharts-cartesian-axis').length).toBeGreaterThanOrEqual(2);
  });

  it('renderiza linhas e a legenda customizada', () => {
    const { container } = render(
      <ChartContainer config={config} className="h-[200px] w-[400px]">
        <LineChart data={data} width={400} height={200}>
          <XAxis dataKey="name" />
          <ChartLegend content={<ChartLegendContent />} />
          <Line dataKey="enviados" stroke="var(--color-enviados)" />
          <Line dataKey="abertos" stroke="var(--color-abertos)" />
        </LineChart>
      </ChartContainer>
    );

    expect(container.querySelectorAll('.recharts-line').length).toBe(2);
    expect(container.querySelectorAll('.recharts-line-curve').length).toBe(2);
    expect(container.textContent).toContain('Enviados');
    expect(container.textContent).toContain('Abertos');
  });
});
