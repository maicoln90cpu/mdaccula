

## Plano: Trocar BUNNY_CDN_HOST para cdn.mdaccula.com

### Mudancas necessarias

**1. `src/lib/imageUtils.ts` linha 13**
- De: `const BUNNY_CDN_HOST = 'https://mdaccula.b-cdn.net';`
- Para: `const BUNNY_CDN_HOST = 'https://cdn.mdaccula.com';`

**2. `index.html` linhas 9-10**
- De: `preconnect` e `dns-prefetch` para `mdaccula.b-cdn.net`
- Para: `cdn.mdaccula.com`

Sao apenas essas 2 mudancas. Toda a logica de reescrita ja passa pelo `BUNNY_CDN_HOST`, entao trocar a constante propaga para todos os componentes (og:image, OptimizedImage, avatar /links, etc).

---

### Como funciona o fluxo de cache (explicacao simples)

```text
Visitante pede imagem
        |
        v
  [1] Cloudflare (cdn.mdaccula.com)
      "Tenho no cache?" 
         SIM → devolve direto (0 custo, super rapido)
         NAO ↓
        v
  [2] Bunny CDN (origin do Cloudflare)
      "Tenho no cache?"
         SIM → devolve pro Cloudflare (custo Bunny, nao Supabase)
         NAO ↓
        v
  [3] Supabase Storage (origin do Bunny)
      Devolve a imagem original
      (unico momento que gera egress no Supabase)
```

**Primeira vez** que alguem pede uma imagem: passa pelos 3 niveis. Gera egress no Supabase UMA vez.

**Segunda vez em diante** (por 1 mes): Cloudflare devolve do cache. Zero egress no Supabase, zero custo no Bunny.

**Bots sociais** (WhatsApp, Facebook, Google): tambem batem no Cloudflare. Se a imagem ja esta em cache, zero egress.

### O que voce economiza

- **Supabase egress**: cai de ~1 GB/dia para ~50-100 MB/dia (somente primeiros acessos de imagens novas)
- **Bunny bandwidth**: tambem reduz, pois Cloudflare intercepta antes
- **Velocidade**: Cloudflare tem PoPs no Brasil, entrega mais rapido que Bunny

### Voce fez certo?

Sim. A arquitetura esta correta:
- `cdn.mdaccula.com` → CNAME para Bunny → Bunny puxa do Supabase
- Cloudflare com cache de 1 mes no `cdn.mdaccula.com`
- O teste que voce fez ja confirma que funciona

A unica coisa que falta e trocar a URL no codigo de `mdaccula.b-cdn.net` para `cdn.mdaccula.com`.

