

## Diagnostico: Imagens quebradas no CDN

### O que esta acontecendo

Testei as URLs do CDN (`cdn.mdaccula.com`) server-side e elas **retornam dados validos**. Porem, no browser as imagens falham e o `onError` substitui todas pelo fallback `dj-performance.jpg`.

A causa mais provavel: o **cache do Bunny CDN** (e possivelmente do Cloudflare na frente) esta servindo respostas cacheadas erradas (possivelmente 403 da epoca do `?quality=75`, ou respostas parciais). Como o cache esta configurado com 1 ano de expiracao, essas respostas ruins ficam presas.

### Solucao em 2 partes

**Parte 1 -- Manual (voce no painel):**
- **Bunny CDN**: Acesse o painel Bunny > Pull Zone > **Purge Cache** (purge completo)
- **Cloudflare** (se `cdn.mdaccula.com` passa por Cloudflare): Acesse Cloudflare > Caching > **Purge Everything**
- Isso forca o CDN a buscar as imagens originais novamente do Supabase

**Parte 2 -- Codigo (fallback inteligente):**

Atualmente, quando a imagem CDN falha, o `onError` pula direto para `djImage`. Vou adicionar um fallback intermediario: **tentar a URL original do Supabase** antes de cair no `djImage`.

Arquivos alterados:
- `src/lib/imageUtils.ts` -- adicionar funcao `getOriginalSupabaseUrl()` que reverte CDN -> Supabase
- `src/pages/Eventos.tsx` -- onError tenta Supabase antes de djImage
- `src/pages/Blog.tsx` -- onError tenta Supabase antes de djImage
- `src/components/OptimizedImage.tsx` -- onError tenta Supabase antes do gradiente
- `src/components/sections/LatestNews.tsx` -- corrigir dupla chamada de `getOptimizedImageUrl` (esta sendo chamada 2x: uma no componente pai e outra dentro do `OptimizedImage`)

### Logica do fallback

```text
CDN URL falha → tenta URL original Supabase → se tambem falha → djImage/gradiente
```

Funcao nova em `imageUtils.ts`:
```
getOriginalSupabaseUrl(cdnUrl) → reverte cdn.mdaccula.com/path → supabase.co/.../path
```

