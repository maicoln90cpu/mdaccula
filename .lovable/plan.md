

## Plano de Correção — 3 Itens

### 1. Bug: editar título do blog não salva

**Causa raiz**: O campo `Categoria` aparece em branco ao editar (visível no screenshot). O componente `Select` usa `defaultValue={post?.category}` mas o react-hook-form não tem `register('category')` — usa apenas `setValue` no `onValueChange`. Quando o post tem uma categoria como "Lançamentos" que NÃO está na lista `CATEGORIES` (`['Eventos', 'Cena SP', 'Festivais', 'História', 'Guias', 'Entrevistas']`), o Select não encontra match e fica em branco. Se o usuário não toca no campo, `data.category` chega como `undefined` ou string vazia, e o update pode falhar ou gravar null.

**Correção** em `src/components/blog/BlogForm.tsx`:
- Usar `Controller` do react-hook-form para o Select (em vez de `onValueChange` manual)
- Expandir `CATEGORIES` para incluir todas as categorias que existem no banco: adicionar `'Lançamentos'`, `'Produtores'`, `'Tecnologia'`, `'Cultura'`
- Garantir que o valor default é passado corretamente via Controller

### 2. Títulos repetitivos nos posts gerados por IA

**Causa raiz**: O prompt em `generate-blog-suggestions/index.ts` (linha 282) pede "Título ÚNICO e atraente" mas não instrui sobre **formato/estrutura** do título. A IA converge para o padrão `"X: como Y faz Z"` repetidamente.

**Correção** em `supabase/functions/generate-blog-suggestions/index.ts`:
- Adicionar ao prompt instrução explícita de **variação de formato**:
  - Proibir repetir a estrutura "X: como Y" em mais de 1 título
  - Sugerir formatos alternativos: pergunta, lista ("5 motivos..."), afirmação direta, provocação, metáfora
  - Adicionar regra: "Cada título DEVE usar uma estrutura gramatical diferente dos demais"

### 3. Analytics mostra 0 views em eventos

**Causa raiz confirmada**: `EventDetail.tsx` (linha 97) chama `supabase.rpc('increment_event_views')` diretamente — isso incrementa o campo `views` na tabela `events`, MAS **não insere registro na tabela `event_view_events`**. O analytics por período usa `event_view_events` para contar views filtrados por data. Como nenhum registro é inserido lá, o resultado é sempre 0.

Para comparação, `BlogPost.tsx` chama `supabase.functions.invoke("track-view", { body: { postId } })` que faz AMBOS: incrementa views E insere em `blog_view_events`.

**Correção** em `src/pages/EventDetail.tsx`:
- Substituir o `supabase.rpc('increment_event_views')` direto por `supabase.functions.invoke("track-view", { body: { eventId: eventData.id } })`
- A Edge Function `track-view` já suporta `eventId` — ela incrementa views E insere em `event_view_events`

### Arquivos a alterar

1. `src/components/blog/BlogForm.tsx` — usar Controller para Select, expandir CATEGORIES
2. `supabase/functions/generate-blog-suggestions/index.ts` — instruções de variação de formato no prompt
3. `src/pages/EventDetail.tsx` — trocar rpc direto por chamada a `track-view`

