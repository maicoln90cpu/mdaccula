

## Diagnostico final

Olhando os prints e o codigo, o problema tem duas causas combinadas:

1. **`getOptimizedImageUrl` adiciona `?width=480&quality=70`** — isso redimensiona imagens verticais (flyers de evento, ex: 1080x1920) para 480px de largura, resultando em ~270px de altura. Quando o CSS espera preencher um container `aspect-[3/4]` ou `aspect-video`, a imagem transformada nao tem pixels suficientes e fica distorcida ou pixelada.

2. **Mistura de `object-cover` e `object-contain`** — em iteracoes anteriores, alternamos entre os dois sem consistencia. O usuario quer `contain` em TODOS os lugares (mostrar a imagem inteira, sem corte).

### Plano de correcao

**Principio**: remover parametros de transformacao (width/quality) e manter apenas a reescrita de dominio para o Bunny CDN. Assim a imagem original (sem redimensionamento) e servida pelo CDN com cache, e o CSS controla o layout com `object-contain`.

#### Arquivo 1: `src/lib/imageUtils.ts`

Simplificar `getOptimizedImageUrl` para fazer APENAS reescrita de dominio (Supabase → Bunny CDN), sem adicionar parametros `width`/`quality`/`resize`. Remover `IMAGE_PRESETS` por enquanto (nao serao usados).

```text
Antes:  https://mdaccula.b-cdn.net/event-images/foto.webp?width=480&quality=70
Depois: https://mdaccula.b-cdn.net/event-images/foto.webp
```

Isso elimina toda distorcao causada por redimensionamento server-side. O Bunny CDN continua cacheando a imagem original.

#### Arquivo 2: `src/components/OptimizedImage.tsx`

- Remover `srcset` gerado (cada URL com `?width=320`, `?width=640` etc. aponta para transformacao que nao queremos agora)
- Remover props `transformWidth` e `transformQuality`
- Manter `objectFit` como prop mas com default `contain`

#### Arquivos 3-12: Todos os locais que usam `objectFit="cover"` ou `object-cover`

Trocar para `object-contain` em TODOS os locais de imagem:

| Arquivo | Local | Mudanca |
|---------|-------|---------|
| `src/pages/Eventos.tsx` L571 | card grid | `object-cover` → `object-contain` |
| `src/pages/Blog.tsx` L397 | featured post | `object-cover` → `object-contain` |
| `src/pages/Blog.tsx` L476 | post grid | `object-cover` → `object-contain` |
| `src/pages/BlogPost.tsx` L210 | post detail | ja usa `object-contain` — manter |
| `src/pages/EventDetail.tsx` L240 | event detail | ja usa `object-contain` — manter |
| `src/pages/EventDetail.tsx` L375 | related post | `object-cover` → `object-contain` |
| `src/pages/EventDetail.tsx` L453 | related event | `object-cover` → `object-contain` |
| `src/components/sections/FeaturedEvents.tsx` L117 | home events | `objectFit="cover"` → `objectFit="contain"` |
| `src/components/sections/LatestNews.tsx` L108 | home news | `objectFit="cover"` → `objectFit="contain"` |
| `src/components/events/EventModal.tsx` L54 | modal | ja usa `object-contain` — manter |
| `src/components/events/EventsCarousel.tsx` L65 | carousel | `object-cover` → `object-contain` |
| `src/components/links/SortableLinkCard.tsx` L136, L170 | link cards | `object-cover` → `object-contain` |

#### Ajuste de containers

Para `object-contain` funcionar bem, os containers precisam de espaco suficiente. Onde o container for muito baixo (ex: `aspect-video` = 16:9 para flyer vertical), ajustar:

- Eventos grid: `aspect-[3/4]` → `aspect-auto` com `max-h-[400px]` (deixar a imagem definir a altura)
- Blog grid: `aspect-video` → manter (blogs sao geralmente horizontais, `contain` funciona)
- FeaturedEvents home: `aspect-video` → manter
- Links: sem alteracao (thumbnails pequenas 40x40 e 64x64)

#### Arquivo 13: Chamadas com `IMAGE_PRESETS`

Todos os locais que passam `IMAGE_PRESETS.card`, `IMAGE_PRESETS.thumbnail` etc. serao atualizados para chamar `getOptimizedImageUrl(url)` sem segundo parametro, ja que a funcao agora so faz reescrita de dominio.

Locais afetados:
- `src/pages/Eventos.tsx`
- `src/pages/Blog.tsx`
- `src/pages/BlogPost.tsx`
- `src/pages/EventDetail.tsx`
- `src/components/events/EventsCarousel.tsx`
- `src/components/sections/FeaturedEvents.tsx`
- `src/components/sections/LatestNews.tsx`
- `src/components/admin/VirtualizedLinkList.tsx`
- `src/components/admin/ai-content/PostsHistory.tsx`
- `src/components/admin/MultiEventArticleModal.tsx`
- `src/pages/admin/RecurringEventsManager.tsx`
- `src/pages/admin/BlogManager.tsx`
- `src/components/links/SortableLinkCard.tsx`

### Impacto no Bunny CDN

A reescrita de dominio continua funcionando — o Bunny CDN cacheia a imagem original. Sem transformacao, as imagens serao maiores (~200-500 KB em vez de ~70 KB), mas o cache do Bunny reduz egress do Supabase igualmente. O custo de bandwidth no Bunny sobe levemente mas continua insignificante (~$1-3/mes).

No futuro, podemos reativar Image Transformation com parametros mais inteligentes (ex: `width` proporcional ao container) sem distorcer.

### Resumo

- 1 arquivo de utilitario (`imageUtils.ts`) simplificado
- 1 componente (`OptimizedImage.tsx`) simplificado
- ~13 arquivos com troca de `object-cover` → `object-contain` e remocao de `IMAGE_PRESETS`
- Resultado: imagens mostradas inteiras em todos os lugares, sem corte, sem distorcao

