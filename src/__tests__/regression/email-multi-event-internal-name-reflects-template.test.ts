/**
 * R-067 — 15/08/2026, lapidação depois do R-065: o rascunho real criado na
 * E-goi pra Music ON + One Life (template "FDS Sem Taxa — múltiplos
 * eventos") apareceu no painel da E-goi com o nome interno "MDAccula •
 * Virada de lote (2 eventos) • 2026-08-15" — "Virada de lote" estava fixo em
 * create-multi-event-email-campaign/index.ts, independente do template
 * realmente usado. O frontend (dispatchMultiEventDraftEmail) não mandava
 * nenhuma informação do template pra edge function, diferente do fluxo de
 * evento único (que já manda template_type). Corrigido repassando o nome do
 * template selecionado (Template.name, ex.: "FDS Sem Taxa — múltiplos
 * eventos") do componente até o nome interno da campanha.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-067 — nome interno da campanha multi-evento reflete o template real', () => {
  it('create-multi-event-email-campaign: lê template_name do body e usa no internalName, com fallback seguro', () => {
    const src = read('supabase/functions/create-multi-event-email-campaign/index.ts');
    expect(src).toMatch(/const templateNameRaw = body\?\.template_name/);
    expect(
      src,
      'internalName precisa usar o rótulo derivado de template_name, não mais o texto "Virada de lote" fixo.'
    ).toMatch(/const internalName = `MDAccula • \$\{templateLabel\}/);
    // Nunca pode voltar a ser um literal fixo sem nenhuma variável.
    expect(src).not.toMatch(/const internalName = `MDAccula • Virada de lote \(/);
    // Fallback: sem template_name, ainda funciona (não quebra chamador futuro).
    expect(src).toMatch(/\|\| 'Virada de lote'/);
  });

  it('dispatchMultiEventDraftEmail: aceita templateName e repassa como template_name no body da invocação', () => {
    const src = read('src/lib/emailTemplates/dispatchEventDraft.ts');
    const fnStart = src.indexOf('export async function dispatchMultiEventDraftEmail');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = src.slice(fnStart, fnStart + 2500);
    expect(fnBody).toMatch(/templateName\?:\s*string/);
    expect(fnBody).toMatch(/invokeBody\.template_name = opts\.templateName/);
  });

  it('useEmailDispatch: dispara o multi-evento passando o nome do template selecionado (selectedManualTemplate?.name)', () => {
    const src = read('src/components/admin/emailConfig/useEmailDispatch.ts');
    const callStart = src.indexOf('dispatchMultiEventDraftEmail(batchEventIds');
    expect(callStart, 'Não encontrei a chamada a dispatchMultiEventDraftEmail.').toBeGreaterThan(-1);
    const callBlock = src.slice(callStart, callStart + 400);
    expect(
      callBlock,
      'A chamada precisa passar templateName: selectedManualTemplate?.name, senão o nome interno na E-goi volta a ficar genérico.'
    ).toMatch(/templateName:\s*selectedManualTemplate\?\.name/);
  });
});
