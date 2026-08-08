/**
 * Regressão R-031 — Duplicar template "Virada de lote" perdia a seleção
 * múltipla de eventos.
 *
 * Bug original (agosto/2026):
 *   `duplicateTemplate()` (EmailTemplateEditor.tsx) hardcodava
 *   `type: 'custom'` no insert da cópia, mesmo quando o template original
 *   era `ticket_batch_multi` ("Virada de lote — múltiplos eventos"). Como
 *   a seleção múltipla de eventos na aba Envio Manual depende estritamente
 *   de `template.type === 'ticket_batch_multi'` (useManualBatch.ts), a
 *   cópia virava um template de evento único sem nenhum aviso — o
 *   checkbox de múltiplos eventos simplesmente sumia.
 *
 * Correção:
 *   `duplicateTemplate()` passa a usar `type: activeTpl.type`, preservando
 *   o tipo original (e toda capacidade que depende dele) na cópia.
 *
 * Este teste é estático (sem rede): lê o código-fonte e garante que
 * `duplicateTemplate` não volta a hardcodar `type: 'custom'`.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-031 — duplicateTemplate preserva o type original', () => {
  it('EmailTemplateEditor.tsx não hardcoda mais type: "custom" na duplicação', () => {
    const src = read('src/components/admin/EmailTemplateEditor.tsx');
    const duplicateFnBlock = src.slice(
      src.indexOf('const duplicateTemplate'),
      src.indexOf('const deleteTemplate')
    );
    expect(
      duplicateFnBlock,
      'duplicateTemplate() voltou a hardcodar type: \'custom\' — isso REINTRODUZ a regressão ' +
        'R-031 (cópia de um template ticket_batch_multi perde a multi-seleção de eventos). ' +
        'Use type: activeTpl.type.'
    ).not.toMatch(/type:\s*'custom'/);
    expect(duplicateFnBlock).toMatch(/type:\s*activeTpl\.type/);
  });

  it('a multi-seleção de eventos no envio manual continua chaveada pelo type do template', () => {
    const src = read('src/components/admin/emailConfig/useManualBatch.ts');
    expect(src).toMatch(/isMultiEventTemplate\s*=\s*selectedManualTemplate\?\.type\s*===\s*'ticket_batch_multi'/);
  });
});
