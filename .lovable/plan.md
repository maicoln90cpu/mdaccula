
## Correcao de Imagens Quebradas

### Diagnostico

Todas as imagens do projeto estao retornando **404 (Object not found)** do Supabase Storage. Isso acontece porque o ambiente de **Test** (preview) do Lovable Cloud possui o banco de dados com as URLs de imagens, mas o **bucket de storage** `event-images` esta vazio neste ambiente. Os arquivos de imagem existem apenas no ambiente **Live** (producao).

Isso afeta:
- Blog posts (imagens de artigos)
- Eventos (imagens de flyers)
- Links customizados (thumbnails)
- Carousel de eventos

### Solucao em 2 Partes

#### Parte 1: Melhorar o tratamento de fallback no codigo

Atualmente, quando uma imagem falha ao carregar, o navegador exibe o texto alternativo (alt) como icone de imagem quebrada. Vou corrigir todos os componentes para exibir um **placeholder visual bonito** com gradiente quando a imagem falhar.

**Arquivos a modificar:**

1. **`src/components/OptimizedImage.tsx`** - Ja possui fallback para `/placeholder.svg`, mas o placeholder.svg em si pode nao ser visivel. Melhorar para mostrar um gradiente com icone quando a imagem falha.

2. **`src/pages/Blog.tsx`** - Os `<img>` tags no featured post e nos cards do blog nao possuem tratamento de erro (`onError`). Adicionar fallback para imagem local `djImage` que ja esta importada no componente.

3. **`src/components/sections/LatestNews.tsx`** - Usa `OptimizedImage` que ja tem fallback, mas o fallback `/placeholder.svg` pode nao funcionar. Melhorar.

4. **`src/components/sections/FeaturedEvents.tsx`** - Usa `OptimizedImage`, mesmo caso acima.

5. **`src/components/events/EventModal.tsx`** - O `<img>` do modal nao tem `onError` handler.

6. **`src/components/events/EventsCarousel.tsx`** - Ja possui fallback com gradiente (o `LazyEventImage` ja trata erro). OK, nao precisa de alteracao.

**Mudancas especificas:**

- Em `Blog.tsx`: Adicionar `onError` handler nos `<img>` tags do featured post e dos cards que substitui o `src` pelo `djImage` importado localmente (que ja funciona pois esta no bundle).

- Em `EventModal.tsx`: Adicionar `onError` handler que esconde a imagem ou mostra um gradiente placeholder.

- Em `OptimizedImage.tsx`: Melhorar o fallback para usar um gradiente visual ao inves de `/placeholder.svg` (que tambem pode estar inacessivel).

- Em `LatestNews.tsx` e `FeaturedEvents.tsx`: Garantir que o fallback funcione adequadamente.

#### Parte 2: Re-upload das imagens (acao do usuario)

As imagens precisam ser re-enviadas para o storage do ambiente Test, ou o usuario pode **publicar** o projeto para que o ambiente Live seja usado (onde as imagens ja existem). Isso nao eh algo que eu consiga resolver via codigo - depende de:

- **Publicar o projeto** para usar o ambiente Live (mais rapido)
- **Ou** re-fazer upload das imagens pelo painel admin

### Detalhes Tecnicos

Componentes modificados e a mudanca em cada um:

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Blog.tsx` (linhas 393-398, 471-477) | Adicionar `onError={(e) => { e.currentTarget.src = djImage }}` nos dois `<img>` tags |
| `src/components/events/EventModal.tsx` (linha 52-57) | Adicionar estado `hasError` e `onError` handler com fallback para gradiente |
| `src/components/OptimizedImage.tsx` (linha 73-80) | Melhorar fallback: ao inves de `/placeholder.svg`, mostrar div com gradiente |
| `src/components/sections/LatestNews.tsx` (linha 103-109) | Substituir `OptimizedImage` por `<img>` com `onError` fallback para `djImage` |
| `src/components/sections/FeaturedEvents.tsx` (linha 104-110) | Mesmo tratamento - adicionar fallback robusto |
