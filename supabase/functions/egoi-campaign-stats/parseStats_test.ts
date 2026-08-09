// Regressão: até 2026-08-09 o edge function chamava um endpoint da E-goi
// que não existe (GET /campaigns/email/{id}/statistics → 404 em toda
// tentativa), então event_email_campaign_stats nunca era gravado e o
// Dashboard de e-mails sempre mostrava métricas zeradas. O path correto,
// confirmado contra os SDKs oficiais da E-goi (Python e Javascript), é
// GET /reports/email/{campaign_hash}. O SDK oficial tipa os campos de
// EmailReportOverall (sends, opens, unique_opens, clicks, unique_clicks,
// hard_bounces, soft_bounces, complaints, unsubscriptions) como allOf, o
// que sugeria merge no nível raiz — mas a resposta REAL da API aninha esses
// campos sob a chave "overall" (confirmado ao vivo em produção, mesmo dia:
// o primeiro deploy gravava stats_json com tudo zerado apesar da E-goi
// retornar números reais, porque a leitura não sabia procurar em
// "overall").
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseStats } from './parseStats.ts';

Deno.test('parseStats lê os campos de dentro de "overall" (shape real da E-goi em produção)', () => {
  const result = parseStats({
    campaign_hash: 'abc123',
    overall: {
      sends: 100,
      opens: 50,
      unique_opens: 40,
      clicks: 12,
      unique_clicks: 8,
      hard_bounces: 2,
      soft_bounces: 1,
      complaints: 0,
      unsubscriptions: 1,
    },
  });

  assertEquals(result.sent, 100);
  assertEquals(result.bounces, 3);
  assertEquals(result.delivered, 97);
  assertEquals(result.opens_unique, 40);
  assertEquals(result.opens_total, 50);
  assertEquals(result.clicks_unique, 8);
  assertEquals(result.clicks_total, 12);
  assertEquals(result.unsubscribes, 1);
  assertEquals(result.complaints, 0);
  assertEquals(result.open_rate, +((40 / 97) * 100).toFixed(2));
  assertEquals(result.click_rate, +((8 / 97) * 100).toFixed(2));
});

Deno.test('parseStats faz fallback pro nível raiz se "overall" não vier (robustez, não o caso real)', () => {
  const result = parseStats({
    sends: 100,
    opens: 50,
    unique_opens: 40,
    clicks: 12,
    unique_clicks: 8,
  });
  assertEquals(result.sent, 100);
  assertEquals(result.opens_unique, 40);
});

Deno.test('parseStats não quebra com corpo vazio/desconhecido', () => {
  const result = parseStats({});
  assertEquals(result.sent, 0);
  assertEquals(result.delivered, 0);
  assertEquals(result.open_rate, 0);
  assertEquals(result.click_rate, 0);
});

Deno.test('index.ts usa o endpoint correto /reports/email/ (não .../statistics)', async () => {
  const src = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
  const matches = src.match(/`\/reports\/email\/\$\{encodeURIComponent\([^)]+\)\}`/g) ?? [];
  if (matches.length < 2) {
    throw new Error(
      `Esperava 2 chamadas para /reports/email/{id} (modo sync_all e modo campanha única), achou ${matches.length}. ` +
        'Se o path mudou de novo, confirme contra o SDK oficial da E-goi antes de editar — ' +
        'o path antigo (/campaigns/email/{id}/statistics) não existe e sempre retorna 404.',
    );
  }
  if (src.includes('/statistics`')) {
    throw new Error('index.ts ainda referencia o path quebrado .../statistics — regressão do bug de métricas zeradas.');
  }
});
