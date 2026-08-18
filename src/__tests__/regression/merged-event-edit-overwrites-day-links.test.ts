/**
 * Regressão R-073 — editar um evento mesclado bagunçava os links de venda
 * dos outros dias do festival.
 *
 * Bug original (achado em auditoria, agosto/2026):
 *   `useEventFormSubmit` sincronizava `custom_links` a cada salvamento de
 *   evento com um único `UPDATE ... WHERE event_id = <evento>`, sem filtrar
 *   por link específico. Um evento "guarda-chuva" resultado de mesclagem
 *   (`tickets_per_day=true`) tem vários `custom_links` — 1 por dia, cada um
 *   com seu próprio `override_date`/`override_time`/`url`. Qualquer edição
 *   do evento (mesmo só corrigir um texto) colapsava `override_date`/
 *   `override_time`/`title`/`url` de TODOS esses links pro mesmo valor,
 *   destruindo o mapeamento dia-a-dia. Confirmado nos dados reais do merge
 *   "Parador Reveillon" (dias 29, 30 e 31/12 perderam seus links próprios).
 *
 * Correção:
 *   Antes de montar o update de `custom_links`, conta quantos links estão
 *   vinculados ao evento. Se for mais de 1 (festival mesclado), não
 *   sobrescreve título/subtítulo/data/hora/link — cada dia mantém o seu.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(
  path.join(process.cwd(), 'src/components/events/eventForm/useEventFormSubmit.tsx'),
  'utf-8'
);

describe('Regressão R-073 — edição de evento mesclado não deve bagunçar links dos outros dias', () => {
  it('conta quantos custom_links estão vinculados ao evento antes de sincronizar', () => {
    expect(
      src,
      'Não encontrei a contagem de custom_links vinculados (isMultiLinkEvent) em ' +
        'useEventFormSubmit.tsx. Veja docs/TESTING.md → Regressões cobertas → R-073.'
    ).toMatch(/isMultiLinkEvent/);
  });

  it('só sobrescreve título/data/link do custom_links quando o evento tem 1 link só (não é festival mesclado)', () => {
    const guardIndex = src.indexOf('if (!isMultiLinkEvent)');
    expect(
      guardIndex,
      'A sincronização de override_date/override_time/title/url em custom_links precisa ' +
        'estar condicionada a "!isMultiLinkEvent" — senão volta a colapsar os links de ' +
        'todos os dias de um festival mesclado no mesmo valor. Veja R-073.'
    ).toBeGreaterThan(-1);

    const guardBlock = src.slice(guardIndex, guardIndex + 700);
    expect(guardBlock).toMatch(/override_date:\s*data\.date/);
    expect(guardBlock).toMatch(/override_time:\s*data\.time/);
    expect(guardBlock).toMatch(/title:\s*data\.title/);
  });
});
