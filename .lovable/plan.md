

## Melhorias no filtro de periodo e cliques por periodo

### Problema atual

O filtro de periodo esconde os cards (filtra por `created_at`). O usuario quer que **todos os cards aparecam sempre**, e o periodo sirva apenas para filtrar a **contagem de cliques**.

Porem, atualmente os cliques sao armazenados apenas como um contador inteiro (`clicks` na tabela `redirect_links`). Nao existe tabela de eventos de clique com timestamp, entao nao e possivel saber quantos cliques ocorreram "hoje" ou "esta semana".

### Solucao

#### Parte 1: Criar tabela de eventos de clique

Criar a tabela `redirect_click_events` para registrar cada clique individualmente com timestamp:

```text
redirect_click_events
- id (uuid, PK)
- redirect_link_id (uuid, FK -> redirect_links.id)
- clicked_at (timestamptz, default now())
- ip_hash (text, opcional)
```

RLS: admins podem ler (SELECT), service role pode inserir (INSERT).

#### Parte 2: Atualizar Edge Function `track-redirect-click`

Alem de incrementar o contador (`increment_redirect_clicks`), tambem inserir um registro em `redirect_click_events` com o `redirect_link_id` e timestamp.

#### Parte 3: Query de cliques por periodo

Adicionar uma query separada que busca cliques agrupados por `redirect_link_id` dentro do periodo selecionado:

```sql
SELECT redirect_link_id, COUNT(*) as period_clicks
FROM redirect_click_events
WHERE clicked_at >= [data_inicio]
GROUP BY redirect_link_id
```

#### Parte 4: UI - Substituir Select de periodo por Popover com calendario

Remover o `Select` de periodo atual e substituir por um `Popover` contendo:
- Botoes de atalho: "Hoje", "7 dias", "30 dias", "Todo periodo"
- Calendario (DatePicker) para selecionar intervalo customizado (data inicio e fim)
- Estado: `dateRange: { from: Date | null, to: Date | null }`

#### Parte 5: UI - Cliques por periodo no card

No card de cada link, ao lado do contador total de cliques, mostrar os cliques do periodo selecionado:

```text
[icon] 142 total  |  23 no periodo
```

Quando "Todo periodo" estiver selecionado, mostrar apenas o total (comportamento atual).

#### Parte 6: Remover filtro de cards por data

O `filterPeriod` atual que esconde cards sera removido. Todos os cards sempre aparecem. O periodo afeta apenas a contagem de cliques exibida.

### Detalhes tecnicos

| Item | Detalhe |
|------|---------|
| Nova tabela | `redirect_click_events` (migracao SQL) |
| Edge function modificada | `supabase/functions/track-redirect-click/index.ts` |
| Arquivo principal | `src/pages/admin/RedirectsManager.tsx` |
| Novos imports | `Popover`, `PopoverContent`, `PopoverTrigger`, `Calendar` (shadcn), `format` (date-fns) |
| Estado removido | `filterPeriod` (tipo string) |
| Estado adicionado | `dateRange: { from: Date \| null, to: Date \| null }` |
| Nova query | `useQuery` para buscar `redirect_click_events` agrupados por link no periodo |
| `hasActiveFilters` | Atualizar para usar `dateRange.from !== null` |

### Limitacao

Cliques antigos (anteriores a criacao da tabela `redirect_click_events`) nao terao dados por periodo -- apenas o total historico (coluna `clicks`) continuara disponivel. Os cliques por periodo so contarao a partir do momento em que a nova tabela estiver ativa.

