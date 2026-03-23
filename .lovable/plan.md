

## Plano de Correção — 2 Itens

### 1. Regeneração de artigo ignora dados atualizados do evento

**Diagnóstico**: A função `generate-multi-event-article` busca dados frescos do banco (linha 104), então o venue atualizado ("Neo Quimica Arena") está sendo passado no prompt. Porém:

- **Causa A**: O campo `description` do evento pode conter texto antigo mencionando "Vale do Anhangabaú". A IA lê esse campo e prioriza ele sobre o campo `venue`.
- **Causa B**: A IA tem conhecimento de treinamento forte sobre "Timewarp São Paulo = Vale do Anhangabaú" e ignora a instrução do prompt.
- **Causa C**: Na função `generate-blog-post-v2` (evento único), o título antigo do post é passado como `seriesName` (linha 180 do BlogManager), e o título antigo pode conter o local antigo.

**Correção**:

1. **`supabase/functions/generate-multi-event-article/index.ts`**:
   - Adicionar instrução explícita no system prompt: "Use EXCLUSIVAMENTE os dados fornecidos. NÃO use conhecimento prévio sobre locais ou datas. Se o local informado difere do que você sabe, USE O INFORMADO."
   - No `datesInfo`, incluir `venue` e `address` de cada evento individual (hoje só mostra o `commonVenue` do primeiro)

2. **`supabase/functions/generate-blog-post-v2/index.ts`**:
   - Adicionar instrução similar ao system prompt sobre priorizar dados fornecidos sobre conhecimento prévio

3. **`src/pages/admin/BlogManager.tsx`**:
   - Na regeneração multi-evento, não passar `postTitle` como `seriesName` — usar `event.title` do primeiro evento para evitar título com local antigo

### 2. Espaçamento entre cards do blog

**Diagnóstico**: A listagem do blog em `Blog.tsx` linha 473 usa `space-y-20` (80px) mas visualmente os cards parecem colados. Olhando o screenshot, o problema é que os cards são `Card` com borda mas sem gap visual forte entre eles. Na página de eventos, cada card tem mais padding e margin natural.

**Correção** em `src/pages/Blog.tsx`:
- Trocar `space-y-20` para `space-y-8` (32px) — espaçamento mais equilibrado e visível
- Adicionar `py-4` ou `p-2` ao wrapper do Link para dar respiro visual
- Alternativa: usar `gap-8` com `flex flex-col` em vez de `space-y`

Olhando o screenshot novamente: os cards já têm `space-y-20` mas parecem juntos. Provavelmente o `Card` tem bordas finas que se confundem. A solução é:
- Manter `space-y-12` (48px — bom equilíbrio)
- Adicionar `border-border/50` e um leve `shadow-md` para destacar cada card individualmente

### Arquivos a alterar

1. `supabase/functions/generate-multi-event-article/index.ts` — instrução anti-override de dados
2. `supabase/functions/generate-blog-post-v2/index.ts` — instrução anti-override de dados
3. `src/pages/admin/BlogManager.tsx` — não reusar título antigo como seriesName
4. `src/pages/Blog.tsx` — ajustar espaçamento entre cards

