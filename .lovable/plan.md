
## Objetivo

Centralizar TODAS as métricas reais (Supabase + Bunny CDN) dentro do `/admin/egress`, hoje os números mostrados são estimativas via Service Worker e divergem muito da realidade. Vamos passar a usar as APIs oficiais.

---

## Diagnóstico atual

**O que temos hoje:**
- `EgressMonitor.tsx` lê tabela `egress_metrics` (instrumentação manual via Service Worker + edge functions). Cobertura ~80%, sem GB real.
- Edge function `supabase-usage` chama `/v1/projects/{ref}/analytics/endpoints/usage.api-counts` — só retorna **contagem de requisições**, não bytes, não DB, não storage.
- Zero integração com Bunny: todo o tráfego de imagens (que é a maior parte) é invisível na nossa plataforma.

**O que o Supabase agora oferece (Metrics API beta):**
- Endpoint Prometheus-compatível por projeto: `https://{ref}.supabase.co/customer/v1/privileged/metrics` (auth via service_role).
- ~200 séries: CPU, RAM, disco, conexões DB, query stats, WAL, IO, egress de DB, storage size, auth requests, realtime connections etc.
- Formato: texto Prometheus exposition (parse simples).

**O que o Bunny oferece (Statistics API):**
- `GET https://api.bunny.net/statistics?dateFrom=&dateTo=&pullZone=&serverZoneId=` com header `AccessKey: <api-key>`.
- Retorna: `TotalBandwidthUsed` (bytes), `TotalRequestsServed`, `CacheHitRate`, `BandwidthUsedChart`, `RequestsServedChart`, `CacheHitRateChart`, `GeoTrafficDistribution`, `Error3xx/4xx/5xxChart`, `OriginTrafficChart`.
- Também temos `/storagezone/{id}/statistics` para uso da storage zone.

---

## Plano em 3 fases

### Fase 1 — Substituir `supabase-usage` por Prometheus Metrics API

1. Reescrever a edge function `supabase-usage` para:
   - Fazer `fetch` no endpoint Prometheus do projeto com `Authorization: Bearer <service_role>` (já temos `SUPABASE_SERVICE_ROLE_KEY`). Fallback: continuar usando o `MANAGEMENT_API_PAT` se o Prometheus exigir.
   - Implementar parser Prometheus simples (regex linha-a-linha) — sem dependência externa.
   - Extrair e devolver JSON estruturado com as séries que importam:
     - `db_size_bytes`, `db_connections_active/max`
     - `cpu_usage_percent`, `memory_used_bytes/total`
     - `disk_used_bytes/total`, `disk_io_read/write_bytes`
     - `network_egress_bytes_total` (por serviço: rest, auth, storage, realtime)
     - `pgrest_request_count`, `auth_request_count`, `storage_request_count`
   - Aceitar query param `?raw=1` para devolver o texto Prometheus cru (debug).

2. Cachear resposta por 60s em uma tabela `metrics_cache` (key, payload jsonb, fetched_at) para evitar chamar a API a cada refresh — o Prometheus do Supabase tem rate limit.

### Fase 2 — Edge function `bunny-stats`

1. Criar `supabase/functions/bunny-stats/index.ts`:
   - Auth: exige admin (`has_role`).
   - Aceita `?dateFrom=&dateTo=&hourly=true|false`.
   - Faz duas chamadas em paralelo:
     - `GET /statistics` (pull zone — bandwidth/requests/cache/geo).
     - `GET /storagezone/{id}/statistics` (uso da storage zone).
   - Devolve payload normalizado: `{ bandwidth, requests, cacheHitRate, charts: {...}, geo: [...], errors: {3xx,4xx,5xx}, storage: {...} }`.
   - Cache de 5 minutos na mesma `metrics_cache`.

2. Secrets necessários:
   - `BUNNY_ACCOUNT_API_KEY` (diferente de `BUNNY_STORAGE_API_KEY` — é a Account-level API Key obtida em https://dash.bunny.net/account/settings).
   - `BUNNY_PULL_ZONE_ID` (ID numérico do pull zone).
   - `BUNNY_STORAGE_ZONE_ID` (ID numérico da storage zone).

### Fase 3 — Refatorar a UI `/admin/egress`

Reorganizar com 3 abas no topo:

```text
[ Estimativa Interna (SW) ] [ Supabase (oficial) ] [ Bunny CDN (oficial) ]
```

- **Estimativa Interna**: o conteúdo atual (mantém para comparar tendência).
- **Supabase**: novos KPIs + gráficos vindos do Prometheus:
  - DB size, conexões ativas, CPU/RAM, egress por serviço (auth/rest/storage/realtime), requisições por endpoint top 10.
- **Bunny CDN**: KPIs principais (Bandwidth total, Requests, Cache hit rate, Storage used, Erros 4xx/5xx), gráfico de banda diária, mapa/lista de geo distribution, separação cache hit vs miss.
- KPI "Egress Total Real" no header soma `Supabase egress + Bunny bandwidth` — esse é o número que importa.

---

## Detalhes técnicos

- Banco: nova tabela `metrics_cache (key text PK, payload jsonb, fetched_at timestamptz default now())` com RLS apenas admin SELECT.
- Service role key já existe; só precisamos confirmar acesso ao endpoint Prometheus (testar via `supabase--curl_edge_functions` antes).
- Parser Prometheus: ~30 linhas em Deno, regex `^(\w+)(\{[^}]*\})?\s+([0-9.eE+-]+)$`.
- Recharts já está no projeto, reutilizar `AreaChart`, `BarChart`, `PieChart` (geo).

---

## O que vou precisar de você

Para a Fase 2 funcionar, vou pedir 3 secrets (com instruções claras de onde pegar) **somente depois que você aprovar este plano**:

1. `BUNNY_ACCOUNT_API_KEY` — em https://dash.bunny.net/account/settings (aba "API").
2. `BUNNY_PULL_ZONE_ID` — número que aparece na URL quando você abre a pull zone no painel.
3. `BUNNY_STORAGE_ZONE_ID` — idem, na storage zone "mdaccula".

**Não preciso de prints** — basta colar os 3 valores quando eu pedir.

---

## Pendências fora deste plano (sugestões)

- Alertas: enviar e-mail quando egress projetado passar de 80% do free tier.
- Export CSV das métricas Bunny mensais.

Aprove para eu começar pela Fase 1 (substituição do `supabase-usage`) e na sequência pedir os secrets do Bunny para a Fase 2.
