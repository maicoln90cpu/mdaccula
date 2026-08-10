/**
 * R-054 — O filtro do claim era reaplicado pelo PostgREST depois do UPDATE,
 * mas email_campaign_dispatched_at não fazia parte do RETURNING. Isso gerava
 * 42703 ("column events.email_campaign_dispatched_at does not exist") mesmo
 * com a coluna presente na tabela public.events. Corrigido incluindo a coluna
 * no `.select()` — real, mas insuficiente: o `dispatch_in_progress`
 * persistente foi rastreado até a causa definitiva no R-059 (ver
 * dispatch-claim-count-not-returning-filter.test.ts), que REMOVE o
 * `.select()` do claim inteiramente. Este teste foi atualizado pra refletir
 * o padrão atual em vez de continuar cobrando um `.select()` que não existe
 * mais — a captura original do bug (coluna fora do RETURNING) fica só no
 * comentário acima e em docs/TESTING.md.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-054 — claim do disparo não usa mais .select() encadeado (superseded pelo R-059)', () => {
  it('create-event-email-campaign: o UPDATE do claim não encadeia .select() (evita o problema de RETURNING refiltrado)', () => {
    const source = read('supabase/functions/create-event-email-campaign/index.ts');
    const claimStart = source.indexOf("update({ email_campaign_dispatched_at: now }, { count: 'exact' })");
    expect(claimStart, 'Claim do disparo único deve usar update(..., { count: "exact" }) — ver R-059.').toBeGreaterThan(-1);

    const claimEnd = source.indexOf('await claimQuery;', claimStart);
    expect(claimEnd).toBeGreaterThan(claimStart);
    const claimQueryBlock = source.slice(claimStart, claimEnd);
    expect(
      claimQueryBlock,
      'O UPDATE do claim não deve encadear .select() — o RETURNING reaplica o WHERE contra os valores NOVOS da linha, ' +
        'e como o filtro testa a própria coluna que acabou de ser sobrescrita, nunca bate (R-059).'
    ).not.toMatch(/\.select\(/);
  });

  it('create-multi-event-email-campaign: o UPDATE do claim também não encadeia .select()', () => {
    const source = read('supabase/functions/create-multi-event-email-campaign/index.ts');
    const claimStart = source.indexOf("update({ email_campaign_dispatched_at: now }, { count: 'exact' })");
    expect(claimStart, 'Claim multi-evento deve usar update(..., { count: "exact" }) — ver R-059.').toBeGreaterThan(-1);

    const claimEnd = source.indexOf('await claimQuery;', claimStart);
    expect(claimEnd).toBeGreaterThan(claimStart);
    const claimQueryBlock = source.slice(claimStart, claimEnd);
    expect(claimQueryBlock).not.toMatch(/\.select\(/);
  });
});
