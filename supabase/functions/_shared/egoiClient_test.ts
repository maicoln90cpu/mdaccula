// Regressão: sendEgoiCampaign montava { type: "segment", segment_id } pro
// corpo de POST .../actions/send, mas o schema real da E-goi (confirmado
// contra o SDK oficial, github.com/E-goi/sdk-javascript,
// docs/OSegmentsActionSend.md) usa `data: string[]` — não `segment_id`.
// Toda campanha enviada com um segmento específico (qualquer coisa
// diferente do padrão "toda a lista") falhava com 422 `data.isEmpty`,
// silenciosamente, achado numa campanha real de produção em 2026-08-09.
// Como sendEgoiCampaign é compartilhado por 9 edge functions diferentes
// (envio manual, automações, agendamento, lembrete de evento), este teste
// cobre o helper uma vez só em vez de duplicar em cada chamador.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const originalFetch = globalThis.fetch;

function mockFetchCapturingBody(capture: { body?: string }) {
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    capture.body = init?.body as string;
    return Promise.resolve(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  }) as typeof fetch;
}

Deno.test('sendEgoiCampaign envia segments.data como array de strings quando segmentId é passado', async () => {
  const { sendEgoiCampaign } = await import('./egoiClient.ts');
  const capture: { body?: string } = {};
  mockFetchCapturingBody(capture);
  try {
    await sendEgoiCampaign('hash123', 42, 'fake-key', 99);
    const parsed = JSON.parse(capture.body!);
    assertEquals(parsed.segments, { type: 'segment', data: ['99'] });
    assertEquals(parsed.list_id, 42);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('sendEgoiCampaign envia segments={type:"none"} sem data quando não há segmentId', async () => {
  const { sendEgoiCampaign } = await import('./egoiClient.ts');
  const capture: { body?: string } = {};
  mockFetchCapturingBody(capture);
  try {
    await sendEgoiCampaign('hash123', 42, 'fake-key', null);
    const parsed = JSON.parse(capture.body!);
    assertEquals(parsed.segments, { type: 'none' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
