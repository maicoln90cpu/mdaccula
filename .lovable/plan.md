
## Objetivo imediato

Resolver dois pontos sem quebrar mais telas:

1. **/links com erro** (build/runtime por import inválido de `IMAGE_PRESETS`).
2. **Padronização definitiva de imagens sem corte** em **todos os contextos de conteúdo** (eventos, links, blog listagem, artigo, detalhes), sempre com `contain`.
3. Ajustar a imagem do **artigo do blog** para ficar **aprox. metade do tamanho atual** (desktop), mantendo boa responsividade no mobile.

## Diagnóstico consolidado (com base no código atual)

- O erro de `/links` está confirmado em `src/components/links/SortableLinkCard.tsx`:
  - ainda existe `import { getOptimizedImageUrl, IMAGE_PRESETS }`
  - ainda existe `getOptimizedImageUrl(rawImage, IMAGE_PRESETS.thumbnail)`
  - `IMAGE_PRESETS` não é mais exportado em `src/lib/imageUtils.ts`
- A otimização atual em `src/lib/imageUtils.ts` já está em modo **quality-only** (`?quality=75`), sem width/height forçados — isso está alinhado com sua exigência de não deformar.
- Ainda há inconsistências visuais entre componentes por combinação de:
  - `object-fit` misto (`contain`, `fill`, `cover` em pontos específicos)
  - containers com altura/aspect muito agressivos para imagens verticais (especialmente em cards de blog/eventos)
- No artigo (`src/pages/BlogPost.tsx`), a imagem principal está num wrapper amplo (`max-w-4xl`) e por isso você percebe “grande demais”.

## Plano de implementação (execução em 3 blocos)

### Bloco 1 — Hotfix de estabilidade (primeiro, para destravar /links)

1. **`src/components/links/SortableLinkCard.tsx`**
   - Remover `IMAGE_PRESETS` do import.
   - Trocar chamada para:
     - de: `getOptimizedImageUrl(rawImage, IMAGE_PRESETS.thumbnail)`
     - para: `getOptimizedImageUrl(rawImage)`

Resultado esperado: build volta a passar e `/links` deixa de quebrar com `does not provide an export named 'IMAGE_PRESETS'`.

---

### Bloco 2 — Regra global “sem corte” (contain) para conteúdo

Aplicar regra única para imagens editoriais/flyers/thumbnails de conteúdo:
- `object-contain`
- `w-full h-full` (ou equivalente com dimensão fixa do card)
- container com `bg-muted/20` para acomodar áreas vazias naturalmente

#### Arquivos-alvo de conteúdo (confirmados no projeto)
- `src/pages/Eventos.tsx`
- `src/components/events/EventsCarousel.tsx`
- `src/components/events/EventModal.tsx`
- `src/pages/EventDetail.tsx` (hero + relacionados)
- `src/pages/Blog.tsx` (destaque + grid)
- `src/components/sections/LatestNews.tsx`
- `src/components/sections/FeaturedEvents.tsx`
- `src/pages/BlogPost.tsx`
- `src/components/links/SortableLinkCard.tsx`
- `src/components/admin/VirtualizedLinkList.tsx`
- `src/components/admin/ai-content/PostsHistory.tsx`
- `src/pages/admin/BlogManager.tsx`
- `src/pages/admin/RecurringEventsManager.tsx`
- `src/components/admin/MultiEventArticleModal.tsx`

#### Correção importante em Links
No `SortableLinkCard`, além do import:
- trocar `object-fill` do thumbnail padrão para `object-contain` (evita esticar).

---

### Bloco 3 — Ajuste específico do artigo do blog (“metade do tamanho”)

Em `src/pages/BlogPost.tsx`, seção da imagem principal:
- reduzir wrapper da imagem de `max-w-4xl` para **`max-w-2xl`** (desktop ~ metade visual).
- manter centralizado (`mx-auto`).
- manter `object-contain`.
- adicionar limite vertical para telas grandes (ex.: `max-h-[55vh]`) para não dominar o viewport.

Comportamento final:
- mobile: continua fluido e legível.
- desktop: imagem do artigo fica visualmente menor, como solicitado, sem corte.

## Ajuste de otimização inteligente (sem distorção)

Em `src/lib/imageUtils.ts`, manter estratégia atual de qualidade apenas, com pequeno hardening:

- manter:
  - reescrita Supabase Storage → Bunny CDN
  - `?quality=75` (sem width/height/resize)
- robustez extra:
  - se URL já tiver querystring, concatenar com `&quality=75` em vez de `?quality=75`
  - evitar duplicar `quality` se já existir

```text
Cliente
  -> URL Supabase (/storage/v1/object/public/...)
  -> getOptimizedImageUrl
  -> URL Bunny CDN + quality-only
  -> CSS object-contain no componente
  => imagem inteira, sem crop, sem deformação
```

## Critério de aceite (checklist de QA)

### Build e estabilidade
- `vite build --mode development` sem erro de export/import.
- `/links` carrega sem tela de erro.

### Visual “sem corte” (E2E manual)
Testar desktop + mobile em:
- `/eventos`
- `/eventos/:slug`
- `/blog`
- `/blog/:slug` (exemplo citado por você)
- `/links`
- home (seções `FeaturedEvents` e `LatestNews`)

Validar em cada rota:
- imagem **inteira visível**
- sem distorção/esticamento
- pode sobrar espaço lateral/superior/inferior (aceitável e esperado)
- fallback funciona quando imagem falha

### Regressão de performance básica
- requests de imagem apontam para `mdaccula.b-cdn.net`
- query contém `quality=75`
- sem parâmetros de resize forçados

## Risco e mitigação

- **Risco**: alguns cards podem parecer “com bordas vazias” (letterbox/pillarbox).
- **Mitigação**: isso é comportamento esperado de `contain`; melhorar apresentação com `bg-muted/20` e alinhamento consistente.
- **Risco**: algum componente isolado ainda com `object-cover` fora do escopo de conteúdo.
- **Mitigação**: busca final por `object-cover` + revisão manual apenas de imagens editoriais (não avatars de equipe/logos circulares quando o corte for intencional).

## Entregáveis finais

1. `/links` corrigida (erro de `IMAGE_PRESETS` eliminado).
2. Pipeline de imagem estabilizado com Bunny CDN + quality-only sem resize forçado.
3. Comportamento uniforme de exibição integral (`contain`) em eventos/blog/links/detalhes.
4. Imagem principal de artigo reduzida para ~metade no desktop, mantendo responsividade.
