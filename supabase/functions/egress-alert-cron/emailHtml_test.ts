// Redesign do e-mail de alerta (usuário reportou "ficou horrível" no layout
// antigo, um <div> solto com <ul>/<li> cru) pra usar a mesma estrutura
// table-based/tema escuro do e-mail diário de métricas, com os números que
// causaram o alerta em vermelho.
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildAlertEmailHtml, type AlertTopPath } from './emailHtml.ts';

const baseParams = {
  reason: 'total_24h_acima_de_500MB & spike_4.63x_vs_media',
  mb24h: 908.13,
  baselineDailyMb: 196.16,
  observedRatio: 4.63,
  thresholdMb: 500,
  ratioThreshold: 2,
  topPaths: [] as AlertTopPath[],
  triggeredAtLabel: '09/08/2026 09:00 BRT',
};

Deno.test('buildAlertEmailHtml: usa wrapper completo <html>/<head>/<body> com fundo escuro declarado (mesmo padrão do e-mail diário)', () => {
  const html = buildAlertEmailHtml(baseParams);
  assertStringIncludes(html, '<html');
  assertStringIncludes(html, '<body');
  assertStringIncludes(html, 'name="color-scheme" content="dark"');
});

Deno.test('buildAlertEmailHtml: inclui o logo no topo, igual ao e-mail diário', () => {
  const html = buildAlertEmailHtml(baseParams);
  assertStringIncludes(html, 'https://mdaccula.com/logo-mdaccula.jpeg');
  assertStringIncludes(html, 'alt="MDAccula"');
});

Deno.test('buildAlertEmailHtml: mostra o motivo do disparo e o horário', () => {
  const html = buildAlertEmailHtml(baseParams);
  assertStringIncludes(html, 'total_24h_acima_de_500MB');
  assertStringIncludes(html, 'spike_4.63x_vs_media');
  assertStringIncludes(html, '09/08/2026 09:00 BRT');
});

Deno.test('buildAlertEmailHtml: número de 24h e proporção aparecem em vermelho (#f87171) — dados de problema', () => {
  const html = buildAlertEmailHtml(baseParams);
  assertStringIncludes(html, 'color:#f87171;font-weight:700;font-size:14px;">908.13 MB');
  assertStringIncludes(html, 'color:#f87171;font-weight:700;font-size:14px;">4.63×');
});

Deno.test('buildAlertEmailHtml: média 7d (referência, não é o problema) NÃO sai em vermelho', () => {
  const html = buildAlertEmailHtml(baseParams);
  assertStringIncludes(html, 'color:#ffffff;font-weight:700;font-size:14px;">196.16 MB');
});

Deno.test('buildAlertEmailHtml: sem top paths, não gera a seção "Top caminhos"', () => {
  const html = buildAlertEmailHtml(baseParams);
  assertEquals(html.includes('Top caminhos'), false);
});

Deno.test('buildAlertEmailHtml: com top paths, lista cada caminho com MB e fonte, maior contribuinte em vermelho', () => {
  const html = buildAlertEmailHtml({
    ...baseParams,
    topPaths: [
      { api_path: '/rest/v1/email_templates', egress_bytes: 517245560, source: 'sw' },
      { api_path: '/rest/v1/egoi_config', egress_bytes: 6118880, source: 'sw' },
    ],
  });
  assertStringIncludes(html, 'Top caminhos');
  assertStringIncludes(html, '/rest/v1/email_templates');
  assertStringIncludes(html, '493.28 MB');
  assertStringIncludes(html, '/rest/v1/egoi_config');
  assertStringIncludes(html, '5.84 MB');
  assertStringIncludes(html, `color:#f87171;font-weight:700;">/rest/v1/email_templates`);
});

Deno.test('buildAlertEmailHtml: escapa HTML no motivo (defesa, mesmo vindo de valor interno)', () => {
  const html = buildAlertEmailHtml({ ...baseParams, reason: '<script>alert(1)</script>' });
  assertEquals(html.includes('<script>alert'), false);
  assertStringIncludes(html, '&lt;script&gt;');
});

Deno.test('buildAlertEmailHtml: link pro dashboard do Egress Monitor está presente', () => {
  const html = buildAlertEmailHtml(baseParams);
  assertStringIncludes(html, 'https://mdaccula.com/admin/egress-monitor');
});
