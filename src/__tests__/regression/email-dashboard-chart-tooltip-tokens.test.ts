/**
 * Regressão — tooltip dos gráficos (Recharts) ilegível no tema escuro.
 *
 * `<Tooltip />` puro do Recharts renderiza com fundo branco/inline por
 * padrão; como o app aplica `text-foreground` (quase branco) globalmente
 * via `body`, o texto do tooltip herdava essa cor — texto quase-branco
 * sobre fundo branco, efetivamente invisível no tema escuro do admin.
 * Achado pelo usuário no Dashboard de e-mails; o mesmo bug existia em
 * `Analytics.tsx` (público) e nos gráficos de pizza de
 * `AIAnalyticsDashboard.tsx` — os gráficos de barra/linha desse último
 * arquivo já usavam `contentStyle` com tokens e estavam OK.
 *
 * Fix: EmailDashboard.tsx e Analytics.tsx passaram a usar o componente
 * compartilhado `ChartTooltip`/`ChartTooltipContent` (`@/components/ui/chart`,
 * já correto e usado em `egressMonitor/*`). AIAnalyticsDashboard.tsx só
 * ganhou o mesmo `contentStyle` com tokens que os gráficos de barra/linha
 * do próprio arquivo já usavam (fix mínimo, sem introduzir um padrão novo
 * nesse arquivo).
 *
 * Teste estático (sem render): garante que nenhum dos 3 arquivos volta a
 * ter um <Tooltip /> sem estilo nenhum.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — tooltips de gráfico respeitam os tokens de design (legíveis no tema escuro)', () => {
  it('EmailDashboard.tsx usa ChartTooltip/ChartTooltipContent nos 2 gráficos', () => {
    const src = read('src/components/admin/EmailDashboard.tsx');
    expect(src).toMatch(/import \{ ChartContainer, ChartTooltip, ChartTooltipContent/);
    expect((src.match(/<ChartTooltip content={<ChartTooltipContent \/>} \/>/g) ?? []).length).toBe(2);
    expect(src).not.toMatch(/<Tooltip \/>/);
  });

  it('Analytics.tsx usa ChartTooltip/ChartTooltipContent nos 2 gráficos', () => {
    const src = read('src/pages/Analytics.tsx');
    expect(src).toMatch(/import \{ ChartContainer, ChartTooltip, ChartTooltipContent/);
    expect((src.match(/<ChartTooltip content={<ChartTooltipContent \/>} \/>/g) ?? []).length).toBe(2);
    expect(src).not.toMatch(/<Tooltip \/>/);
  });

  it('AIAnalyticsDashboard.tsx: os 2 tooltips de pizza usam contentStyle com tokens', () => {
    const src = read('src/components/admin/AIAnalyticsDashboard.tsx');
    const tooltipBlocks = src.match(/<Tooltip\s+[\s\S]*?\/>/g) ?? [];
    expect(
      tooltipBlocks.length,
      'Esperava 4 <Tooltip> no arquivo (2 barra/linha já OK + 2 de pizza corrigidos aqui)',
    ).toBe(4);
    for (const block of tooltipBlocks) {
      expect(
        block,
        `Tooltip sem contentStyle com tokens — volta a ficar ilegível no tema escuro: ${block}`,
      ).toMatch(/contentStyle=\{\{[\s\S]*backgroundColor: 'hsl\(var\(--background\)\)'/);
    }
  });
});
