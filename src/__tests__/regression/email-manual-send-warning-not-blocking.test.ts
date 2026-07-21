/**
 * Regressão R-023 — Envio manual de e-mail ficava travado por avisos não-bloqueantes.
 *
 * Bug original (julho/2026):
 *   `dispatchBatch`/`scheduleBatch` (EmailConfig.tsx) já classificavam as
 *   pendências de `manualComposition.issues` via `partitionIssues` (warnings
 *   vs blockers) e só interrompiam o envio de fato por `blockers`. Mas os
 *   botões "Enviar teste" / "Criar rascunho na E-goi" / `SendNowButton` /
 *   `ScheduleSendPanel` continuavam com `disabled={... manualComposition.issues.length > 0 ...}`
 *   — a checagem *bruta*, sem partição — então o clique nunca chegava a
 *   acontecer quando havia só warnings (ex.: DESCRIPTION_MISSING), mesmo o
 *   handler por baixo já permitindo o envio. Reportado ao tentar enviar o
 *   template "Virada de Lote" pro evento "Sun" (descrição vazia).
 *
 * Correção:
 *   Os 4 controles passam a desabilitar só com `manualIssuePartition.blockers.length > 0`
 *   (mesma partição usada pelos handlers), e o card de aviso mostra "Pendências
 *   (não impedem o envio)" em amber quando só há warnings, reservando o
 *   vermelho "Corrija antes de enviar" pra blockers de verdade.
 *
 * Este teste é estático (sem rede): lê o código-fonte e garante que os
 * controles de envio não voltam a usar a checagem bruta de issues.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { partitionIssues, WARNING_ISSUE_CODES } from '@/lib/emailTemplates/issueClassifier';
import type { EmailCompositionIssue } from '@/lib/emailTemplates/emailComposer';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-023 — botões de envio manual não travam mais por warning', () => {
  it('EmailConfig.tsx não usa mais manualComposition.issues.length bruto pra desabilitar os controles de envio', () => {
    const src = read('src/pages/admin/EmailConfig.tsx');
    const sendControlsBlock = src.slice(
      src.indexOf('flex flex-wrap items-center justify-end gap-2 pt-2 border-t'),
      src.indexOf('O disparo é registrado no')
    );
    expect(
      sendControlsBlock,
      'Os botões de envio manual (teste/rascunho/enviar/agendar) voltaram a usar ' +
        'manualComposition.issues.length bruto — isso REINTRODUZ a regressão R-023 ' +
        '(travados até por warnings não-bloqueantes). Use manualIssuePartition.blockers.length.'
    ).not.toMatch(/manualComposition\.issues\.length/);
    expect(sendControlsBlock).toMatch(/manualIssuePartition\.blockers\.length > 0/);
  });

  it('manualIssuePartition é derivado de partitionIssues sobre manualComposition.issues', () => {
    const src = read('src/pages/admin/EmailConfig.tsx');
    expect(src).toMatch(/partitionIssues\(manualComposition\?\.issues\s*\?\?\s*\[\]\)/);
  });

  it('DESCRIPTION_MISSING (o caso reportado) é classificado como warning, não blocker', () => {
    const issues: EmailCompositionIssue[] = [
      { blockId: 'b1', code: 'DESCRIPTION_MISSING', message: 'Preencha a descrição.' },
    ];
    const { warnings, blockers } = partitionIssues(issues);
    expect(warnings).toHaveLength(1);
    expect(blockers).toHaveLength(0);
    expect(WARNING_ISSUE_CODES.has('DESCRIPTION_MISSING')).toBe(true);
  });

  it('dispatchEventDraft.ts filtra weekend_grid/weekly_hero/blog_posts_list/dedge_block em templates de evento único', () => {
    const src = read('src/lib/emailTemplates/dispatchEventDraft.ts');
    expect(src).toMatch(/eventOnlyTemplateTypes/);
    expect(src).toMatch(/weekend_grid.*weekly_hero.*blog_posts_list.*dedge_block/);
  });

  it('EmailConfig.tsx aplica o mesmo filtro de blocos de agenda na prévia do envio manual', () => {
    const src = read('src/pages/admin/EmailConfig.tsx');
    const manualCompositionBlock = src.slice(
      src.indexOf('const manualComposition = useMemo'),
      src.indexOf('const manualIssuePartition')
    );
    expect(
      manualCompositionBlock,
      'A prévia do envio manual (manualComposition) precisa filtrar weekend_grid/weekly_hero/' +
        'blog_posts_list/dedge_block igual dispatchEventDraft.ts — senão a prévia mostra um aviso ' +
        'que o envio real já não teria.'
    ).toMatch(/eventOnlyTemplateTypes/);
  });
});
