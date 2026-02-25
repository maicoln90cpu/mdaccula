

## Analise de Egress — De onde vem 1 GB/dia

### Diagnostico

Analisei todos os arquivos do projeto e identifiquei **3 categorias de egress**:

---

### A) Imagens do Storage (maior custo — ~80% do egress)

O `getOptimizedImageUrl()` reescreve URLs do Supabase para o Bunny CDN **no lado do cliente**. Isso funciona para visitantes humanos. Porem:

**Problemas encontrados:**

1. **og:image e twitter:image usam URL DIRETA do Supabase** — toda vez que WhatsApp, Telegram, Facebook, Google, Twitter fazem preview de um link compartilhado, baixam a imagem diretamente do Supabase, sem passar pelo Bunny CDN:
   - `BlogPost.tsx` linha 149: `content={post.image_url || ""}`
   - `BlogPost.tsx` linha 155: `content={post.image_url || ""}`
   - `EventDetail.tsx` linha 198: `content={event.image_url || ""}`
   - `SEOHead.tsx` linha 40/50: `content={image}`

2. **Preload tag usa URL CDN, mas og:image nao** — inconsistencia em `BlogPost.tsx`

3. **Avatar na pagina /links** (linha 185) nao passa por `getOptimizedImageUrl()` — carrega direto do Supabase

4. **OptimizedImage component** usado em `LatestNews.tsx`, `FeaturedEvents.tsx`, `QuemSomos.tsx`, `Analytics.tsx` — este funciona corretamente via CDN

5. **Imagens geradas por IA sao PNG grandes** — `regenerate-blog-image` salva como `.png` sem compressao. Cada imagem pode ter 1-3 MB.

---

### B) API queries (menor custo — ~10%)

Cada page load faz varias queries ao Supabase (posts, events, settings, links). Isso gera egress de API, mas o volume e pequeno (JSON leve).

---

### C) Edge Functions (menor custo — ~10%)

Tracking functions (track-view, track-link-click, track-redirect-click) fazem INSERT no banco a cada visita. O egress e minimo.

---

### Plano de reducao — 4 acoes

#### 1. Reescrever og:image/twitter:image para Bunny CDN

Bots de social media (WhatsApp, Facebook, Twitter, Google) baixam a imagem do og:image a cada compartilhamento. Com 109 posts publicados, cada compartilhamento gera 1-3 MB de egress direto do Supabase.

**Arquivos:**
- `src/pages/BlogPost.tsx` — aplicar `getOptimizedImageUrl()` nos meta tags og:image e twitter:image
- `src/pages/EventDetail.tsx` — idem
- `src/components/SEOHead.tsx` — aplicar `getOptimizedImageUrl()` no `image` prop antes de renderizar

#### 2. Avatar da pagina /links passar pelo CDN

**Arquivo:** `src/pages/Links.tsx` linha 185
- Aplicar `getOptimizedImageUrl(avatarUrl)` no src da tag img

#### 3. Salvar imagens geradas por IA como JPEG comprimido (nao PNG)

**Arquivo:** `supabase/functions/regenerate-blog-image/index.ts`
- Mudar contentType de `image/png` para `image/jpeg`
- Mudar extensao de `.png` para `.jpg`
- Isso reduz cada imagem de ~2 MB para ~200-400 KB

#### 4. Converter imagens existentes grandes no Storage

**Arquivo:** `supabase/functions/batch-convert-webp/index.ts`
- Ja existe e funciona. Executar uma vez para converter os PNGs grandes restantes no bucket `event-images`

---

### Estimativa de economia

```text
Fonte                          | Antes (estimado/dia) | Depois
-------------------------------|----------------------|--------
og:image (bots sociais)        | ~400 MB              | ~0 MB (Bunny CDN)
Imagens no browser             | ~100 MB              | ~100 MB (ja via CDN)
Avatar /links                  | ~50 MB               | ~0 MB (Bunny CDN)
PNGs de IA nao comprimidos     | ~200 MB              | ~50 MB (JPEG)
API + Edge Functions           | ~100 MB              | ~100 MB (sem mudanca)
-------------------------------|----------------------|--------
TOTAL                          | ~850 MB              | ~250 MB
```

A maior economia vem de **redirecionar og:image para o Bunny CDN**, pois crawlers e bots sociais fazem centenas de requests por dia e cada um baixa a imagem original inteira.

