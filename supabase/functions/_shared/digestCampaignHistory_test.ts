import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { writeDigestCampaignHistory } from './digestCampaignHistory.ts';

function fakeAdmin(insertResult: { error: { message: string } | null }) {
  const calls: unknown[][] = [];
  return {
    calls,
    admin: {
      from(table: string) {
        return {
          insert(rows: unknown[]) {
            calls.push([table, rows]);
            return Promise.resolve(insertResult);
          },
        };
      },
    },
  };
}

Deno.test('writeDigestCampaignHistory: sem eventIds grava 1 linha com event_id null (ex.: blog-digest, sem evento associado)', async () => {
  const { admin, calls } = fakeAdmin({ error: null });
  const warning = await writeDigestCampaignHistory(admin, [], {
    campaignHash: 'abc',
    status: 'sent',
    mode: 'immediate',
    errorMessage: null,
    sentAt: new Date().toISOString(),
    campaignType: 'blog_digest',
    segmentId: null,
  });
  assertEquals(warning, null);
  assertEquals(calls.length, 1);
  const [table, rows] = calls[0] as [string, Array<Record<string, unknown>>];
  assertEquals(table, 'event_email_campaigns');
  assertEquals(rows.length, 1);
  assertEquals(rows[0].event_id, null);
  assertEquals(rows[0].egoi_campaign_id, 'abc');
  assertEquals(rows[0].campaign_type, 'blog_digest');
});

Deno.test('writeDigestCampaignHistory: insere 1 linha por evento, todas com o mesmo egoi_campaign_id', async () => {
  const { admin, calls } = fakeAdmin({ error: null });
  const warning = await writeDigestCampaignHistory(admin, ['e1', 'e2', 'e3'], {
    campaignHash: 'hash-123',
    status: 'sent',
    mode: 'immediate',
    errorMessage: null,
    sentAt: '2026-08-08T12:00:00.000Z',
    campaignType: 'weekend_agenda',
    segmentId: 42,
  });
  assertEquals(warning, null);
  assertEquals(calls.length, 1);
  const [table, rows] = calls[0] as [string, Array<Record<string, unknown>>];
  assertEquals(table, 'event_email_campaigns');
  assertEquals(rows.length, 3);
  assertEquals(rows.map((r) => r.event_id), ['e1', 'e2', 'e3']);
  for (const r of rows) {
    assertEquals(r.egoi_campaign_id, 'hash-123');
    assertEquals(r.status, 'sent');
    assertEquals(r.campaign_type, 'weekend_agenda');
    assertEquals(r.segment_id, 42);
  }
});

Deno.test('writeDigestCampaignHistory: falha no insert retorna aviso em vez de lançar', async () => {
  const { admin } = fakeAdmin({ error: { message: 'boom' } });
  const warning = await writeDigestCampaignHistory(admin, ['e1'], {
    campaignHash: null,
    status: 'failed',
    mode: 'draft',
    errorMessage: 'E-goi 500: erro',
    sentAt: null,
    campaignType: 'weekly_digest',
    segmentId: null,
  });
  assertEquals(warning, 'Aviso: falha ao gravar histórico: boom');
});

Deno.test('writeDigestCampaignHistory: admin.from lançando exceção não propaga (retorna aviso)', async () => {
  const admin = {
    from() {
      throw new Error('conexão recusada');
    },
  };
  const warning = await writeDigestCampaignHistory(admin, ['e1'], {
    campaignHash: null,
    status: 'failed',
    mode: 'draft',
    errorMessage: null,
    sentAt: null,
    campaignType: 'weekly_digest',
    segmentId: null,
  });
  assertEquals(warning, 'Aviso: falha ao gravar histórico: conexão recusada');
});
