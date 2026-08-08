/**
 * Regressão R-034 — Editor de e-mail mostrava "Esquerda" em blocos que já
 * saem centralizados no envio real.
 *
 * Bug original (agosto/2026):
 *   `AlignControl` (controls.tsx) usava um fallback fixo `value || 'left'`
 *   pra exibir o alinhamento, mesmo em blocos cujo renderer real (header,
 *   cta_button, pix_button, secondary_link, image_with_link, social_icons,
 *   lineup, countdown, ticker, footer) usa `"center"` como padrão quando
 *   `align` não está salvo. O e-mail já saía centralizado corretamente —
 *   só o editor mostrava "Esquerda" pra esses mesmos blocos, dando a
 *   impressão de que o editor "não lê" o valor salvo no banco.
 *
 * Correção:
 *   `AlignControl` ganhou um parâmetro `defaultAlign`, usado como
 *   `value ?? defaultAlign`. Os 10 usos do controle nos blocos que
 *   centralizam por padrão passam `defaultAlign="center"`. `pix_button` e
 *   `event_grid` ganharam `case`s em `blockDefaults.ts` (antes ausentes,
 *   então nasciam com `align: undefined` mesmo recém-criados).
 *
 * Este teste é estático (sem rede): lê o código-fonte e garante que os 10
 * usos de AlignControl nos blocos centralizados-por-padrão não perdem o
 * defaultAlign="center", e que blockDefaults.ts continua com os 2 `case`s.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-034 — AlignControl usa defaultAlign correto por tipo de bloco', () => {
  it('AlignControl aceita defaultAlign e usa value ?? defaultAlign (não mais value || "left" fixo)', () => {
    const src = read('src/components/admin/emailTemplateEditor/controls.tsx');
    expect(src).toMatch(/defaultAlign\?:\s*'left'\s*\|\s*'center'\s*\|\s*'right'/);
    expect(src).toMatch(/value=\{value \?\? defaultAlign\}/);
  });

  it('actionProps.tsx passa defaultAlign="center" nos 4 usos (cta_button, pix_button, secondary_link, image_with_link)', () => {
    const src = read('src/components/admin/emailTemplateEditor/blockPropsPanel/actionProps.tsx');
    const matches = src.match(/<AlignControl[^/]*defaultAlign="center"/g) ?? [];
    expect(
      matches.length,
      'Esperava 4 usos de AlignControl com defaultAlign="center" em actionProps.tsx ' +
        '(cta_button, pix_button, secondary_link, image_with_link) — isso REINTRODUZ a regressão R-034.'
    ).toBe(4);
  });

  it('eventProps.tsx passa defaultAlign="center" nos 3 usos (lineup, countdown, ticker)', () => {
    const src = read('src/components/admin/emailTemplateEditor/blockPropsPanel/eventProps.tsx');
    const matches = src.match(/<AlignControl[^/]*defaultAlign="center"/g) ?? [];
    expect(
      matches.length,
      'Esperava 3 usos de AlignControl com defaultAlign="center" em eventProps.tsx ' +
        '(lineup, countdown, ticker) — isso REINTRODUZ a regressão R-034.'
    ).toBe(3);
  });

  it('structuralProps.tsx passa defaultAlign="center" nos 3 usos (header, footer, social_icons)', () => {
    const src = read('src/components/admin/emailTemplateEditor/blockPropsPanel/structuralProps.tsx');
    const matches = src.match(/<AlignControl[^/]*defaultAlign="center"/g) ?? [];
    expect(
      matches.length,
      'Esperava 3 usos de AlignControl com defaultAlign="center" em structuralProps.tsx ' +
        '(header, footer, social_icons) — isso REINTRODUZ a regressão R-034.'
    ).toBe(3);
  });

  it('textProps.tsx e digestProps.tsx NÃO ganham defaultAlign="center" (esses blocos já são left por padrão)', () => {
    const textSrc = read('src/components/admin/emailTemplateEditor/blockPropsPanel/textProps.tsx');
    const digestSrc = read('src/components/admin/emailTemplateEditor/blockPropsPanel/digestProps.tsx');
    expect(textSrc).not.toMatch(/defaultAlign="center"/);
    expect(digestSrc).not.toMatch(/defaultAlign="center"/);
  });

  it('blockDefaults.ts tem case explícito para pix_button e event_grid (antes ausentes)', () => {
    const src = read('src/components/admin/emailTemplateEditor/blockDefaults.ts');
    expect(src).toMatch(/case 'pix_button':\s*\n\s*return \{ id, kind, align: 'center'/);
    expect(src).toMatch(/case 'event_grid':\s*\n\s*return \{ id, kind, title: '', eyebrow: '', align: 'left'/);
  });
});
