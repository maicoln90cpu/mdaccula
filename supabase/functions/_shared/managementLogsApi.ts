/**
 * Query da Logs/Analytics API do Supabase (Management API) — a mesma API
 * usada pelo dashboard e pelo MCP `query_logs`. Cobre fontes que nunca
 * aparecem em `egress_metrics` (ex.: `storage_logs`, leituras de objeto do
 * Storage), fechando o ponto cego que deixou o pico de 11/08/2026 (R-061)
 * passar sem alerta — ver `docs/PENDENCIAS.md`.
 *
 * Requer o secret `SUPABASE_MANAGEMENT_API_TOKEN` (Personal/Service Access
 * Token gerado em supabase.com/dashboard/account/tokens) — ou, como
 * fallback, um secret pré-existente `METRICS_API_KEY` (não usado em nenhum
 * outro lugar do código; se por acaso já for um PAT válido do Supabase,
 * evita ter que gerar um token novo). Sem nenhum dos dois configurado,
 * `isManagementApiConfigured()` retorna false e o chamador deve pular esta
 * checagem em vez de falhar — mesma lição do R-049 (nunca deixar uma
 * dependência de credencial derrubar o alarme inteiro).
 */

export function getProjectRef(supabaseUrl: string | null): string | null {
  if (!supabaseUrl) return null;
  const match = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

function getManagementApiToken(): string | null {
  return Deno.env.get("SUPABASE_MANAGEMENT_API_TOKEN") ?? Deno.env.get("METRICS_API_KEY") ?? null;
}

export function isManagementApiConfigured(): boolean {
  return !!getManagementApiToken() && !!getProjectRef(Deno.env.get("SUPABASE_URL") ?? null);
}

export interface LogsQueryResult {
  rows: Array<Record<string, unknown>>;
}

/** Monta a requisição pra Logs API sem chamar fetch — testável sem mockar rede (mesmo padrão de resendEmail.ts). */
export function buildLogsApiRequest(opts: {
  token: string;
  projectRef: string;
  sql: string;
  isoStart: string;
  isoEnd: string;
}): { url: string; headers: Record<string, string> } {
  const params = new URLSearchParams({
    sql: opts.sql,
    iso_timestamp_start: opts.isoStart,
    iso_timestamp_end: opts.isoEnd,
  });
  return {
    url: `https://api.supabase.com/v1/projects/${opts.projectRef}/analytics/endpoints/logs.all?${params.toString()}`,
    headers: { Authorization: `Bearer ${opts.token}` },
  };
}

/**
 * Roda uma query SQL somente-leitura contra o stream de logs unificado
 * (ClickHouse) via Management API. Lança em caso de erro — o chamador
 * decide como degradar (ver `isManagementApiConfigured`).
 */
export async function queryLogsSql(
  sql: string,
  isoStart: string,
  isoEnd: string,
): Promise<LogsQueryResult> {
  const token = getManagementApiToken();
  const projectRef = getProjectRef(Deno.env.get("SUPABASE_URL") ?? null);
  if (!token || !projectRef) {
    throw new Error(
      "Management API não configurada (SUPABASE_MANAGEMENT_API_TOKEN/METRICS_API_KEY/SUPABASE_URL ausente)",
    );
  }

  const req = buildLogsApiRequest({ token, projectRef, sql, isoStart, isoEnd });
  const resp = await fetch(req.url, { headers: req.headers });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Management API logs.all falhou: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  const rows = Array.isArray(data?.result) ? data.result : [];
  return { rows };
}

/**
 * Conta requisições de Storage (bucket real, não `egress_metrics`) numa
 * janela de tempo. Usa contagem de requests, não bytes — a API de logs não
 * expõe um campo de tamanho de resposta confiável para `storage_logs` neste
 * projeto; contagem já é um sinal real (o pico de 11/08 incluía uma rajada
 * de bots batendo em `/object/info/public/event-images/*` de várias regiões
 * ao mesmo tempo, que contagem detecta mesmo sem bytes).
 */
export async function countStorageRequests(isoStart: string, isoEnd: string): Promise<number> {
  const { rows } = await queryLogsSql(
    "select count(*) as cnt from logs where source = 'storage_logs'",
    isoStart,
    isoEnd,
  );
  return Number(rows[0]?.cnt ?? 0);
}
