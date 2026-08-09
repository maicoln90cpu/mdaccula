/**
 * Regressão — taxa de abertura/clique acima de 3000% no card "Detalhe por
 * campanha" (aba Dashboard de /admin/email-config).
 *
 * `stats.open_rate`/`click_rate` (stats_json gravado pela edge
 * egoi-campaign-stats, via parseStats.ts) já vêm como percentual pronto
 * (0–100, ex: 34.2), não como fração (0–1). `rateFmt()` espera uma fração
 * e multiplica por 100 — usado corretamente nos KPI cards, que recebem
 * `kpis.openRateAvg`/`clickRateAvg` (frações calculadas em aggregate()).
 * A tabela "Detalhe por campanha" passava o percentual já pronto por
 * `rateFmt()`, multiplicando por 100 de novo (34.2 -> "3420.0%").
 *
 * Fix: a tabela usa `pctFmt()`, que só formata o número (já percentual)
 * sem multiplicar. `rateFmt()` e os KPI cards continuam intocados.
 *
 * Teste estático (sem render): garante que a tabela nunca mais volta a
 * chamar rateFmt() nas células de open_rate/click_rate.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — taxa de abertura/clique no "Detalhe por campanha" não duplica a multiplicação por 100', () => {
  it('pctFmt() não multiplica por 100 (stats.open_rate/click_rate já são percentuais)', () => {
    const src = read('src/components/admin/EmailDashboard.tsx');
    const pctFmtDef = src.match(/const pctFmt = \(n: number \| null \| undefined\) =>\s*\n?\s*[^\n]+/);
    expect(pctFmtDef).not.toBeNull();
    expect(pctFmtDef![0]).not.toMatch(/\* 100/);
  });

  it('a tabela "Detalhe por campanha" usa pctFmt (não rateFmt) para r.stats.open_rate/click_rate', () => {
    const src = read('src/components/admin/EmailDashboard.tsx');
    expect(src).toMatch(/pctFmt\(r\.stats\?\.open_rate\)/);
    expect(src).toMatch(/pctFmt\(r\.stats\?\.click_rate\)/);
    expect(src).not.toMatch(/rateFmt\(r\.stats\?\.open_rate\)/);
    expect(src).not.toMatch(/rateFmt\(r\.stats\?\.click_rate\)/);
  });

  it('os KPI cards continuam usando rateFmt com kpis.openRateAvg/clickRateAvg (fração), sem alteração', () => {
    const src = read('src/components/admin/EmailDashboard.tsx');
    expect(src).toMatch(/rateFmt\(kpis\.openRateAvg\)/);
    expect(src).toMatch(/rateFmt\(kpis\.clickRateAvg\)/);
  });
});
