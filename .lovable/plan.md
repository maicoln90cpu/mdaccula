

## Melhorias na pagina /admin/redirects

### 1. Filtro por periodo de data

Adicionar um novo `Select` na barra de filtros existente (linha 221-273) com as opcoes:
- "Todo periodo" (padrao)
- "Hoje"
- "Ultimos 7 dias"
- "Ultimos 30 dias"

**Implementacao:**
- Novo estado `filterPeriod` com valores `"all" | "today" | "7days" | "30days"`
- No `filteredLinks` (linha 94-101), adicionar logica que compara `link.created_at` com a data calculada
- Importar `CalendarDays` do lucide-react para o icone (opcional)

### 2. Ordenacao por mais clicados

Adicionar um novo `Select` ao lado dos filtros para ordenacao:
- "Mais recentes" (padrao, ordenacao atual por `created_at` desc)
- "Mais clicados" (ordena por `clicks` desc)

**Implementacao:**
- Novo estado `sortBy` com valores `"recent" | "clicks"`
- Aplicar `.sort()` no `filteredLinks` apos o `.filter()`, ordenando por `clicks` desc quando selecionado
- Importar `ArrowDownWideNarrow` do lucide-react

### 3. Data de criacao no card

Exibir a data de criacao formatada em cada card de link, junto aos badges de UTM (linha 310-315).

**Implementacao:**
- Adicionar um `<p>` ou `<span>` com `new Date(link.created_at).toLocaleDateString('pt-BR')` abaixo da descricao ou junto aos badges
- Usar icone `Calendar` do lucide-react

### Detalhes tecnicos

**Arquivo modificado:** `src/pages/admin/RedirectsManager.tsx`

| Mudanca | Local no codigo |
|---------|----------------|
| Estado `filterPeriod` | Junto aos estados de filtro (linhas 73-75) |
| Estado `sortBy` | Junto aos estados de filtro |
| Logica de filtro por data | Dentro do `filteredLinks` useMemo (linhas 94-101) |
| Logica de ordenacao | Novo `.sort()` encadeado no `filteredLinks` |
| Select de periodo | Na barra de filtros (linhas 222-254) |
| Select de ordenacao | Na barra de filtros, apos os selects existentes |
| Data de criacao no card | Dentro do card (linha ~308-315), apos description |
| `hasActiveFilters` | Atualizar para incluir `filterPeriod !== "all"` e `sortBy !== "recent"` |

**Imports adicionais:** `Calendar`, `ArrowDownWideNarrow` do lucide-react

Nenhuma mudanca de banco de dados necessaria -- `created_at` e `clicks` ja existem na tabela `redirect_links`.

