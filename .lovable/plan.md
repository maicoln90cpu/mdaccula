
# Plano — Corrigir métricas do Egress Monitor

## Problemas identificados (comparando seus prints com a realidade do Bunny/Supabase)

| # | Aba | Card | Valor mostrado | Esperado | Causa raiz suspeita |
|---|-----|------|----------------|----------|---------------------|
| 1 | Bunny | Bandwidth (Lifetime) | **3.13 GB** | ~60 GB | A função quebra o range em chunks de 40 dias e somando, mas chunks anteriores à criação da pull zone falham silenciosamente (Bunny retorna 400). Resultado: só sobra o chunk mais recente. |
| 2 | Bunny | Custo estimado | $0.13 | ~$2.61 | Mesma causa do #1 (depende do bandwidth). |
| 3 | Bunny | "Bandwidth Diário" chart | só 05‑09 e 05‑10 | série completa | Mesma causa — só o último chunk traz `BandwidthUsedChart` populado. |
| 4 | Banner topo | "Bunny CDN (**7d**)" | "lifetime" | "(7d)" | `payload.window.days` cai no default `7` quando vem `mode=lifetime` (sem `days`). |
| 5 | Supabase | DB Size | **0 B** | ~50–80 MB | O endpoint `usage.api-requests-count` foi usado por engano para DB size. Esse endpoint não devolve `db_size_bytes`. |
| 6 | Supabase | Edge Funcs | **0** | >0 | O endpoint `usage.func-invocations` retorna formato diferente do que o código tenta ler (`row.count / total / total_invocations` não existe). |
| 7 | Supabase | "Total Requests (7d)" hardcoded | "(7d)" | reflete intervalo real | Texto fixo no JSX. |

## Correções planejadas

### A. Edge function `bunny-stats` — pegar lifetime corretamente

Trocar a estratégia atual (chunks de 40 dias varrendo desde 2020) por uma das duas abordagens, na ordem:

1. **Preferida — endpoint `/billing` da Bunny**: `GET https://api.bunny.net/billing` retorna `MonthlyChargesBandwidth`, `MonthlyChargesStorage` e `BillingRecords[]` com totais consumidos por período. É um único request, sem limite de 40 dias. Usar para `lifetime`.
2. **Fallback — descobrir a data de criação da pull zone**: `GET https://api.bunny.net/pullzone/{id}` retorna `DateModified`/`DateCreated`. Iniciar os chunks a partir dessa data (evita chunks vazios/erros pré-existência).
3. Logar cada chunk com `status` e tamanho do response (atualmente falhas viram `null` silenciosamente). Se `okChunks.length < chunks.length`, devolver no payload `chunkErrors: N` para debug futuro.
4. Limpar o cache em memória ao receber `?bust=1` (para forçar refresh sem esperar 5min).

### B. Edge function `bunny-stats` — campo `window.days` para lifetime

Calcular `days` real baseado em `(now - from) / 86400000` em vez de cair no default `7`. Assim o banner mostra "lifetime" ou o número correto.

### C. Edge function `supabase-usage` — DB size real

Usar **um destes** caminhos:
1. **Preferido**: criar uma RPC SQL `get_db_size()` que executa `SELECT pg_database_size(current_database())` (security definer) e chamá-la pelo service-role client. Sem depender do Management API.
2. Alternativa: endpoint Management API `GET /v1/projects/{ref}/database/usage` (se disponível no plano Free).

### D. Edge function `supabase-usage` — Edge Functions invocations reais

Trocar o parser. O endpoint `usage.func-invocations` devolve `result: [{ timestamp, count }]`. O código atual procura múltiplos nomes de campo errados. Corrigir para somar `Number(row.count ?? 0)`.

Como reforço, também passar a usar `analytics_query` indireta: `select count(*) from function_edge_logs where timestamp > now() - interval '7 days'` (mais confiável no plano Free).

### E. Frontend `EgressMonitor.tsx`

1. **Banner global**: trocar o texto fixo `"Bunny CDN ({window.days || days}d)"` por: se `bunnyMode==="lifetime"` mostrar `"Bunny CDN (lifetime)"`, senão `"Bunny CDN ({days}d)"`.
2. **Card "Total Requests (7d)"**: trocar `(7d)` para refletir o intervalo real (pode usar `sbData?.window.interval`).
3. **Card "DB Size"**: depois do fix backend, validar leitura `sbData?.db?.sizeBytes`.
4. **Card "Edge Funcs"**: idem.
5. Acrescentar um pequeno indicador "atualizado há X" baseado em `bunny.fetchedAt` para deixar claro quando o cache de 5min está sendo servido.

## Detalhes técnicos (resumo para devs)

```text
edge: bunny-stats
  - new: GET /pullzone/{id} → use DateCreated as floor for chunks
  - new: GET /billing → primary source for lifetime totals
  - fix: window.days computed (now-from)/86400000, not default 7
  - new: log {url, status, ok} per chunk; expose chunkErrors in payload

edge: supabase-usage
  - new RPC: public.get_db_size() returns bigint security definer
  - fix: edge funcs total uses Number(row.count ?? 0)

frontend: EgressMonitor.tsx
  - banner: lifetime vs Nd label
  - "Total Requests (Xd)" dynamic
  - "Atualizado há X" baseado em fetchedAt
```

## Itens fora do escopo (não vou mexer)

- Estimativa Interna (SW) — você não reportou problema.
- Aba Histórico — o gráfico só populará após snapshots existirem; é esperado.
- Cores / layout das cards.

## Checklist manual após o deploy

1. Abrir `/admin/egress-monitor` na aba **Bunny → Lifetime** → Bandwidth deve ficar próximo de **60 GB** e Custo ≈ **$2.61**.
2. Banner topo deve dizer **"Bunny CDN (lifetime)"** quando aba está em Lifetime; trocar para "Últimos Nd" deve mostrar `Nd`.
3. Na aba **Supabase**: **DB Size** > 0 (provável 30–80 MB) e **Edge Funcs** > 0.
4. Reabrir após 5 min e checar `Atualizado há...` para confirmar refresh.

## Pendências / próximos passos

- Migrar para plano Pro do Supabase para ter `egress bytes` reais (não disponível no Free, indicado no banner).
- Adicionar alerta quando `bunny.bandwidth/dia` exceder X GB (futuro).
