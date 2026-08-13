// Regressão R-061 — monitor de egress era cego pra Supabase Storage/CDN
// (só via egress_metrics/Service Worker, nunca storage_logs). Esta camada
// consulta a Logs/Analytics API (Management API) do Supabase como sinal
// complementar. Testa só a montagem pura da requisição e a detecção de
// configuração — sem mockar fetch, mesmo padrão de resendEmail_test.ts.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildLogsApiRequest, getProjectRef, isManagementApiConfigured } from './managementLogsApi.ts';

Deno.test('getProjectRef extrai o ref do subdomínio de SUPABASE_URL', () => {
  assertEquals(getProjectRef('https://xfvpuzlspvvsmmunznxw.supabase.co'), 'xfvpuzlspvvsmmunznxw');
});

Deno.test('getProjectRef retorna null pra URL ausente ou fora do padrão supabase.co', () => {
  assertEquals(getProjectRef(null), null);
  assertEquals(getProjectRef('https://example.com'), null);
});

Deno.test('buildLogsApiRequest monta a URL da Logs API com sql e janela ISO', () => {
  const req = buildLogsApiRequest({
    token: 'pat-test',
    projectRef: 'xfvpuzlspvvsmmunznxw',
    sql: "select count(*) as cnt from logs where source = 'storage_logs'",
    isoStart: '2026-08-11T00:00:00.000Z',
    isoEnd: '2026-08-12T00:00:00.000Z',
  });
  assertEquals(
    req.url.startsWith(
      'https://api.supabase.com/v1/projects/xfvpuzlspvvsmmunznxw/analytics/endpoints/logs.all?'
    ),
    true
  );
  assertEquals(req.url.includes('iso_timestamp_start=2026-08-11T00%3A00%3A00.000Z'), true);
  assertEquals(req.url.includes('iso_timestamp_end=2026-08-12T00%3A00%3A00.000Z'), true);
});

Deno.test('buildLogsApiRequest usa só Authorization Bearer com o token da Management API', () => {
  const req = buildLogsApiRequest({
    token: 'pat-test',
    projectRef: 'ref',
    sql: 'select 1',
    isoStart: '2026-08-11T00:00:00.000Z',
    isoEnd: '2026-08-12T00:00:00.000Z',
  });
  assertEquals(req.headers['Authorization'], 'Bearer pat-test');
  assertEquals(Object.keys(req.headers), ['Authorization']);
});

Deno.test('isManagementApiConfigured é false sem SUPABASE_MANAGEMENT_API_TOKEN nem METRICS_API_KEY configurados', () => {
  const snapshot = {
    token: Deno.env.get('SUPABASE_MANAGEMENT_API_TOKEN'),
    metricsKey: Deno.env.get('METRICS_API_KEY'),
    url: Deno.env.get('SUPABASE_URL'),
  };
  Deno.env.delete('SUPABASE_MANAGEMENT_API_TOKEN');
  Deno.env.delete('METRICS_API_KEY');
  Deno.env.set('SUPABASE_URL', 'https://xfvpuzlspvvsmmunznxw.supabase.co');
  try {
    assertEquals(isManagementApiConfigured(), false);
  } finally {
    if (snapshot.token !== undefined) Deno.env.set('SUPABASE_MANAGEMENT_API_TOKEN', snapshot.token);
    if (snapshot.metricsKey !== undefined) Deno.env.set('METRICS_API_KEY', snapshot.metricsKey);
    if (snapshot.url !== undefined) Deno.env.set('SUPABASE_URL', snapshot.url);
    else Deno.env.delete('SUPABASE_URL');
  }
});

Deno.test('isManagementApiConfigured aceita METRICS_API_KEY como fallback quando SUPABASE_MANAGEMENT_API_TOKEN não existe', () => {
  const snapshot = {
    token: Deno.env.get('SUPABASE_MANAGEMENT_API_TOKEN'),
    metricsKey: Deno.env.get('METRICS_API_KEY'),
    url: Deno.env.get('SUPABASE_URL'),
  };
  Deno.env.delete('SUPABASE_MANAGEMENT_API_TOKEN');
  Deno.env.set('METRICS_API_KEY', 'existing-secret-value');
  Deno.env.set('SUPABASE_URL', 'https://xfvpuzlspvvsmmunznxw.supabase.co');
  try {
    assertEquals(isManagementApiConfigured(), true);
  } finally {
    if (snapshot.token !== undefined) Deno.env.set('SUPABASE_MANAGEMENT_API_TOKEN', snapshot.token);
    else Deno.env.delete('SUPABASE_MANAGEMENT_API_TOKEN');
    if (snapshot.metricsKey !== undefined) Deno.env.set('METRICS_API_KEY', snapshot.metricsKey);
    else Deno.env.delete('METRICS_API_KEY');
    if (snapshot.url !== undefined) Deno.env.set('SUPABASE_URL', snapshot.url);
    else Deno.env.delete('SUPABASE_URL');
  }
});
