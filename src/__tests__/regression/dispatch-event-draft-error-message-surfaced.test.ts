/**
 * R-052 — Falha real no disparo de e-mail (evento único ou virada de lote
 * multi-evento) aparecia pro admin como um erro genérico ("Edge Function
 * returned a non-2xx status code" — percebido como "erro de função"), mesmo
 * quando `create-event-event-email-campaign`/`create-multi-event-email-campaign`
 * já devolviam uma mensagem JSON descritiva no corpo.
 *
 * Causa: `dispatchEventDraftEmail`/`dispatchMultiEventDraftEmail`
 * (dispatchEventDraft.ts) usavam `error.message` direto no retorno de
 * `supabase.functions.invoke()` — igual ao bug documentado no teste-irmão
 * `edge-function-error-message-surfaced.test.ts`, mas nesse arquivo
 * específico (aba "Envio manual") o helper nunca tinha sido aplicado.
 *
 * Proteção: getEdgeFunctionErrorMessage (src/lib/edgeFunctionErrorMessage.ts)
 * extrai a mensagem real do corpo JSON de erro. Este teste garante que
 * dispatchEventDraft.ts continua usando o helper, não o padrão genérico.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-052 — mensagem real de erro do disparo de e-mail chega ao admin', () => {
  it('dispatchEventDraft.ts usa getEdgeFunctionErrorMessage nos dois disparos (evento único e multi-evento)', () => {
    const source = read('src/lib/emailTemplates/dispatchEventDraft.ts');

    expect(source).toContain("getEdgeFunctionErrorMessage } from '@/lib'");

    const singleEventFn = source.match(
      /export async function dispatchEventDraftEmail[\s\S]*?(?=export async function dispatchAbSubjectTest)/
    );
    expect(singleEventFn, 'Não encontrei dispatchEventDraftEmail.').toBeTruthy();
    expect(singleEventFn![0]).toContain('getEdgeFunctionErrorMessage(error)');
    expect(singleEventFn![0]).not.toContain('error: error.message');

    const multiEventFn = source.match(/export async function dispatchMultiEventDraftEmail[\s\S]*/);
    expect(multiEventFn, 'Não encontrei dispatchMultiEventDraftEmail.').toBeTruthy();
    expect(multiEventFn![0]).toContain('getEdgeFunctionErrorMessage(error)');
    expect(multiEventFn![0]).not.toContain('error: error.message');
  });

  it('create-event-email-campaign e create-multi-event-email-campaign logam a falha não tratada antes do 500', () => {
    // Sem isso, uma falha real (ex.: erro de rede na chamada à E-goi) não deixa
    // nenhum rastro nos logs da Edge Function — nem o admin nem quem for
    // investigar depois consegue saber o que aconteceu, só que deu 500.
    const single = read('supabase/functions/create-event-email-campaign/index.ts');
    expect(single).toMatch(/catch \(e\) \{\s*console\.error\(/);

    const multi = read('supabase/functions/create-multi-event-email-campaign/index.ts');
    expect(multi).toMatch(/catch \(e\) \{\s*console\.error\(/);
  });
});
