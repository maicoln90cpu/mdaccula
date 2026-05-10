## Objetivo
Unificar os filtros de período da página `/admin/egress-monitor`. Hoje há um filtro global (7d/30d/90d) no topo + um filtro local na aba Bunny (Lifetime / Últimos Xd), gerando contradição visual. Vamos consolidar tudo em um único seletor global com 4 opções: **7 dias · 30 dias · 90 dias · Lifetime**, aplicado a todas as abas.

## Mudanças

### 1. `src/pages/admin/EgressMonitor.tsx` (frontend, único arquivo afetado)

**Estado / tipos**
- Trocar `useState<"7d" | "30d" | "90d">` por `useState<"7d" | "30d" | "90d" | "lifetime">`, default `"lifetime"` (alinha com a UX que o usuário já estava vendo na aba Bunny).
- Remover por completo o estado `bunnyMode` e o sub-`Tabs` "Lifetime / Últimos Xd" dentro da aba Bunny.
- Derivar:
  - `isLifetime = period === "lifetime"`
  - `days = period === "7d" ? 7 : period === "30d" ? 30 : 90` (usado só quando não é lifetime)

**Header global**
- Adicionar quarto `TabsTrigger value="lifetime"` ao lado de 7/30/90 dias.

**fetchBunny**
- Body passa a ser: `isLifetime ? { mode: "lifetime" } : { mode: "range", days }` — exatamente o que já era enviado, mas agora dirigido pelo período global.
- Remover dependência `bunnyMode` do `useCallback`; manter `period`/`days` apenas.

**fetchSupabase**
- Hoje envia `interval: "7day"` fixo. Passar a enviar:
  - `7d` → `"7day"`
  - `30d` → `"30day"`
  - `90d` → `"90day"`
  - `lifetime` → `"lifetime"` (a edge `supabase-usage` recebe e ignora se não suportar; sem mudança backend nesta etapa).
- Resultado: a aba Supabase deixa de mostrar sempre 7d quando o usuário escolhe outro período.

**fetchInternal**
- Quando `lifetime`, remover o filtro `gte("period_start", since)` e buscar todas as linhas (com `.order` e `.limit(5000)` para segurança). Caso contrário, comportamento atual.

**fetchSnapshots**
- Já busca 365 dias. Quando `period !== "lifetime"`, filtrar client-side pelos últimos N dias antes de renderizar gráficos/tabelas. Nada a mudar no fetch.

**Aba Bunny — UI**
- Remover o bloco `<div className="flex items-center gap-2"><Tabs value={bunnyMode}…></div>` (linhas ~238-245).
- Substituir nas labels/descrições `bunnyMode === "lifetime" ? "lifetime" : ${days}d` por `isLifetime ? "lifetime" : ${days}d`.

**Refresh button**
- Continua chamando `fetchInternal(); fetchSupabase(); fetchBunny();`. Adicionar `fetchSnapshots()` para consistência.

### 2. Sem mudanças em backend
- `bunny-stats` já aceita `mode: "lifetime" | "range"` + `days`.
- `supabase-usage` continua respondendo; ampliar suporte a outros intervalos pode ser feito num passo futuro se necessário (registrado em pendências).
- `metrics-snapshot` não muda.

## Antes vs Depois
- **Antes:** filtro global 7/30/90 + filtro local Bunny (Lifetime/7d) → cards mostravam $7.10 / 165 GB (lifetime) enquanto o topo dizia "7 dias", causando contradição.
- **Depois:** um único seletor no topo (7d / 30d / 90d / Lifetime). Todas as abas (Bunny, Supabase, Histórico, SW) refletem o mesmo período.

## Pendências / próximos passos sugeridos
- Edge `supabase-usage` ainda tem séries fixas em 7 dias para alguns campos; em iteração futura, propagar `interval` recebido para todas as queries de Logs Explorer.
- Opcional: persistir o período escolhido em `localStorage` para sobreviver a reloads.

## Prevenção de regressão
- Após implementar, conferir manualmente:
  1. Trocar para "Lifetime": Bunny deve mostrar ~60–165 GB conforme dados reais; Supabase/SW devem mostrar dados acumulados sem erro.
  2. Trocar para "7 dias": Bunny cards encolhem para a janela de 7d; nenhum sub-tab visível dentro da aba Bunny.
  3. Botão refresh recarrega todas as abas.
