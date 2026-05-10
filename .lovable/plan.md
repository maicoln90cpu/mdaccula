
## Objetivo

Centralizar TODAS as métricas reais (Supabase + Bunny CDN) dentro do `/admin/egress`. Hoje os números mostrados são estimativas via Service Worker e divergem muito da realidade. Vamos passar a usar as APIs oficiais.

---

## Status dos secrets (já configurados ✅)

- `METRICS_API_KEY` — Secret API key do Supabase (`sb_secret_...`).
- `BUNNY_ACCOUNT_API_KEY`, `BUNNY_PULL_ZONE_ID`, `BUNNY_STORAGE_ZONE_ID`.

---

## Fase 1 — Reescrever `supabase-usage` para Prometheus Metrics API

Endpoint oficial:
```
GET https://xfvpuzlspvvsmmunznxw.supabase.co/customer/v1/privileged/metrics
Auth: Basic (username = "service_role", password = METRICS_API_KEY)
```

A edge function `supabase-usage` passa a:
1. Validar admin (mesmo padrão que já usa hoje).
2. Fazer fetch no endpoint Prometheus com `Authorization: Basic base64("service_role:METRICS_API_KEY")`.
3. Parser Prometheus exposition simples (regex linha-a-linha, ~30 linhas Deno, sem dependência).
4. Extrair as séries que importam:
   - DB: `pg_stat_database_size`, `pg_stat_database_numbackends`, `pg_settings_max_connections`
   - Sistema: `node_cpu_seconds_total`, `node_memory_MemAvailable_bytes` / `MemTotal_bytes`, `node_filesystem_avail_bytes` / `size_bytes`
   - Egress: `pgbouncer_stats_bytes_sent_total`, `realtime_*`, `auth_*`, `storage_*`, `pgrest_*`
   - Requests por serviço (auth, rest, storage, realtime)
5. Retornar JSON normalizado: `{ db: {...}, system: {...}, services: [...], requests_total: N }`.
6. Aceitar `?raw=1` para devolver o texto Prometheus cru (debug).
7. Cache de 60s na nova tabela `metrics_cache`.

## Fase 2 — Edge function nova `bunny-stats`

Cria `supabase/functions/bunny-stats/index.ts`:
- Auth admin.
- Aceita `?dateFrom=&dateTo=&hourly=true|false`.
- Em paralelo chama:
  - `GET https://api.bunny.net/statistics?pullZone=${BUNNY_PULL_ZONE_ID}&dateFrom=...&dateTo=...&hourly=...`
  - `GET https://api.bunny.net/storagezone/${BUNNY_STORAGE_ZONE_ID}/statistics?dateFrom=...&dateTo=...`
  - Header: `AccessKey: ${BUNNY_ACCOUNT_API_KEY}`
- Devolve `{ bandwidth, requests, cacheHitRate, charts, geo, errors:{3xx,4xx,5xx}, storage:{used, files} }`.
- Cache de 5 min na `metrics_cache`.

## Fase 3 — UI `/admin/egress` com 3 abas

```text
[ Estimativa Interna (SW) ] [ Supabase (oficial) ] [ Bunny CDN (oficial) ]
```

- **Estimativa Interna**: conteúdo atual mantido para tendência.
- **Supabase**: KPIs (DB size, conexões, CPU, RAM, Disk) + AreaChart de requests por serviço + tabela top endpoints.
- **Bunny CDN**: KPIs (Bandwidth GB, Requests, Cache Hit %, Storage GB, erros 4xx/5xx), AreaChart banda diária, BarChart geo distribution, donut Hit vs Miss.
- Header global: KPI "Egress Real Total" = Bunny bandwidth + Supabase egress (fonte: ambas APIs).

---

## Detalhes técnicos

- Migration: tabela `metrics_cache (key text PK, payload jsonb, fetched_at timestamptz default now())` + RLS admin SELECT, service_role ALL.
- `supabase/config.toml`: adicionar `[functions.bunny-stats] verify_jwt = false`.
- Recharts já presente; reuso `AreaChart`, `BarChart`, `PieChart`.

---

## Pendências (fora do escopo, sugestões)

- Alerta por e-mail quando `Bunny bandwidth + Supabase egress` projetado mensal > 80% do limite.
- Export CSV mensal Bunny.

Aprove para eu executar Fase 1 → Fase 2 → Fase 3 em sequência.
