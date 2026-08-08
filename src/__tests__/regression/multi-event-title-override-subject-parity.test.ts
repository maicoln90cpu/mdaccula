/**
 * Regressão R-037 — Sobrescrever o título num template "Virada de lote —
 * múltiplos eventos" não mudava o assunto do e-mail (ficava herdado de
 * "N eventos com novo lote hoje").
 *
 * Bug original (agosto/2026, gap deixado pela R-036):
 *   R-036 adicionou `text_override` ao bloco `title`, mas só corrigiu o
 *   renderer do bloco visível (`renderBlock/basic.ts`). O assunto/preheader
 *   do e-mail usa o placeholder `{{event_title}}`, resolvido em
 *   `composeEmail()` a partir de `event.eventTitle` — que pra templates
 *   `ticket_batch_multi` é computado por `buildMultiEventAnnouncementData()`
 *   ANTES de qualquer bloco ser renderizado, sem nenhuma ideia do que o
 *   bloco `title` tinha sobrescrito. Resultado: o H1 visível mudava, mas o
 *   assunto (bem visível na "Revisão final" do Envio Manual) continuava
 *   "2 eventos com novo lote hoje" mesmo com o título sobrescrito.
 *
 * Correção:
 *   `buildMultiEventAnnouncementData()` ganhou `opts.titleOverride` — usado
 *   como `eventTitle` (que alimenta TANTO o bloco `title` quanto o
 *   placeholder do assunto). `useManualBatch.ts` busca o bloco `title` do
 *   template selecionado e repassa seu `text_override` como `titleOverride`
 *   antes de montar a composição multi-evento.
 *
 * Este teste é estático (sem rede): lê o código-fonte e garante que
 * useManualBatch.ts continua repassando o override do bloco title.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-037 — override de título do bloco chega até o assunto do e-mail (multi-evento)', () => {
  it('buildMultiEventAnnouncementData aceita titleOverride e usa como eventTitle', () => {
    const src = read('supabase/functions/_shared/emailComposer.ts');
    const fnBlock = src.slice(
      src.indexOf('export function buildMultiEventAnnouncementData'),
      src.indexOf('const gridEvents = events.map')
    );
    expect(fnBlock).toMatch(/titleOverride\?:\s*string/);
    expect(fnBlock).toMatch(/opts\.titleOverride\?\.trim\(\)\s*\|\|/);
  });

  it('useManualBatch.ts busca o bloco title do template e repassa text_override como titleOverride', () => {
    const src = read('src/components/admin/emailConfig/useManualBatch.ts');
    const multiBlock = src.slice(
      src.indexOf('if (isMultiEventTemplate) {'),
      src.indexOf('return composeEmail')
    );
    expect(
      multiBlock,
      'useManualBatch.ts precisa buscar o bloco title e repassar text_override como titleOverride — ' +
        'isso REINTRODUZ a regressão R-037 (assunto do e-mail volta a ignorar o título sobrescrito).'
    ).toMatch(/b\.kind === 'title'/);
    expect(multiBlock).toMatch(/titleOverride:\s*titleBlock\?\.text_override/);
  });
});
