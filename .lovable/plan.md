

## Plano: Remover width das URLs de imagem, manter apenas quality

### Problema
O `getThumbnailUrl` adiciona `&width=256` / `&width=400` às URLs, distorcendo as imagens nos cards. Você quer que o CDN sirva a imagem original (proporção intacta) e apenas reduza a qualidade para economizar banda.

### Solução

**1. Remover a função `getThumbnailUrl` e usar apenas `getOptimizedImageUrl`**

`src/lib/imageUtils.ts`:
- Remover a função `getThumbnailUrl` completamente (ela só existe para adicionar `width`)
- Manter `getOptimizedImageUrl` com `quality=75` (único parâmetro de otimização)

**2. Substituir todas as chamadas de `getThumbnailUrl` por `getOptimizedImageUrl`**

- `src/components/links/LinkCardImage.tsx` (linha 42): `getThumbnailUrl(rawImage, 256)` → `getOptimizedImageUrl(rawImage)`
- `src/pages/Blog.tsx` (linha 488): `getThumbnailUrl(post.image_url, 400)` → `getOptimizedImageUrl(post.image_url)`
- `src/components/sections/LatestNews.tsx` (linha 106): `getThumbnailUrl(item.image_url, 400)` → `getOptimizedImageUrl(item.image_url)`

**3. Estratégia de redução de tamanho (sem width/height)**

A qualidade `75` já reduz JPEG/WebP em ~40-60% vs original. Para reduzir mais sem mexer em dimensões:
- Manter `quality=75` (bom equilíbrio entre tamanho e nitidez para flyers)
- Bunny Optimizer já converte automaticamente para WebP quando o browser suporta (via header `Accept`), o que reduz ~25-30% adicional sem perda visual

### Arquivos alterados
- `src/lib/imageUtils.ts` — remover `getThumbnailUrl`
- `src/components/links/LinkCardImage.tsx` — usar `getOptimizedImageUrl`
- `src/pages/Blog.tsx` — usar `getOptimizedImageUrl`
- `src/components/sections/LatestNews.tsx` — usar `getOptimizedImageUrl`

