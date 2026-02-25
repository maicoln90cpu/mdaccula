

## Plano de implementacao — 4 itens

### 1) Avatar: botao de upload visivel no LinksManager

O upload de avatar existe em `LinksPageSettings.tsx` (modal "Alterar Template"), mas nao e obvio para o usuario. O botao "Alterar Template" na toolbar do LinksManager abre o modal que contem o upload de avatar.

**Solucao**: Adicionar um botao dedicado "Avatar" na barra de acoes do LinksManager (ao lado de "Alterar Template") que abre o mesmo modal `LinksPageSettings` ja scrollado na secao de avatar. Alternativamente, renomear "Alterar Template" para algo mais claro como "Template & Avatar".

**Arquivo**: `src/pages/admin/LinksManager.tsx` (linha ~507-510)
- Renomear botao de "Alterar Template" para "Template & Avatar" com icone mais claro

---

### 2) Botao "Voltar ao Painel" nas 7 paginas admin que nao tem

Paginas sem botao de voltar:
- `src/pages/admin/DataImport.tsx`
- `src/pages/admin/EventsDashboard.tsx`
- `src/pages/admin/EventTemplates.tsx`
- `src/pages/admin/NewsSourcesManager.tsx`
- `src/pages/admin/PodcastManager.tsx`
- `src/pages/admin/RedirectsManager.tsx`
- `src/pages/admin/SystemHealth.tsx`

**Solucao**: Adicionar em cada uma o padrao consistente:
```tsx
<NavLink to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2 min-h-[44px]">
  <ArrowLeft className="w-4 h-4 mr-2" />
  Voltar ao Painel
</NavLink>
```

---

### 3) LinksAnalytics: secoes colapsadas + filtro de periodo

**Arquivo**: `src/pages/admin/LinksAnalytics.tsx`

Mudancas:
- Inicializar todos os estados de collapse como `false` (linhas 71-78)
- Adicionar estado `timePeriod` com opcoes: "today", "7d", "30d", "all"
- Adicionar barra de filtro de periodo abaixo dos cards de resumo
- Filtrar dados de `blog_posts`, `events` e `redirect_click_events` por `created_at` / `published_at` / `date` baseado no periodo selecionado
- Links (`custom_links.clicks`) nao tem timestamp de clique individual, entao mostrar sempre o total acumulado com nota

---

### 4) EventsManager: filtro padrao "ativos" + filtro por artigo disponivel

**Arquivo**: `src/pages/admin/EventsManager.tsx`

Mudancas:
- Alterar estado inicial de `statusFilter` de `'todos'` para `'ativos'` (linha 44)
- Adicionar novo filtro `articleFilter` com opcoes: "todos", "sem-artigo" (blog_post_id IS NULL), "com-artigo" (blog_post_id IS NOT NULL)
- Adicionar botoes de filtro na barra existente (linhas 272-294)
- Atualizar `filteredEvents` para incluir logica do `articleFilter`

---

## Detalhes tecnicos

### Filtro de periodo (LinksAnalytics)
```typescript
const [timePeriod, setTimePeriod] = useState<'today' | '7d' | '30d' | 'all'>('all');

const getDateFilter = () => {
  const now = new Date();
  switch (timePeriod) {
    case 'today': return new Date(now.setHours(0,0,0,0)).toISOString();
    case '7d': return new Date(now.getTime() - 7*24*60*60*1000).toISOString();
    case '30d': return new Date(now.getTime() - 30*24*60*60*1000).toISOString();
    default: return null;
  }
};
```
Aplicar `.gte('published_at', dateFilter)` nas queries de blog e `.gte('date', dateFilter)` nos eventos. Recarregar dados quando `timePeriod` muda via `useEffect`.

### Filtro de artigo (EventsManager)
```typescript
const [articleFilter, setArticleFilter] = useState<'todos' | 'sem-artigo' | 'com-artigo'>('todos');

// Dentro de filteredEvents:
if (articleFilter === 'sem-artigo' && event.blog_post_id) return false;
if (articleFilter === 'com-artigo' && !event.blog_post_id) return false;
```

