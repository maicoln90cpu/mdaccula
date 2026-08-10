/**
 * R-054 — O filtro do claim era reaplicado pelo PostgREST depois do UPDATE,
 * mas email_campaign_dispatched_at não fazia parte do RETURNING. Isso gerava
 * 42703 ("column events.email_campaign_dispatched_at does not exist") mesmo
 * com a coluna presente na tabela public.events.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'supabase/functions/create-event-email-campaign/index.ts'),
  'utf-8'
);

describe('Regressão R-054 — coluna do filtro permanece no RETURNING do claim', () => {
  it('inclui email_campaign_dispatched_at no select encadeado ao UPDATE', () => {
    const claimStart = source.indexOf(".update({ email_campaign_dispatched_at: now })");
    const claimEnd = source.indexOf('.maybeSingle()', claimStart);

    expect(claimStart).toBeGreaterThan(-1);
    expect(claimEnd).toBeGreaterThan(claimStart);

    const claimBlock = source.slice(claimStart, claimEnd);
    expect(claimBlock).toContain(".select('id,title,status,email_campaign_dispatched_at')");
  });
});