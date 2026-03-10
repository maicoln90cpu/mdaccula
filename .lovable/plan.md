

## Problema identificado

O container das thumbnails e quadrado (`w-14 h-14` / `w-16 h-16`) e os atributos HTML `width={64} height={64}` forcam uma proporcao 1:1. Flyers de eventos sao tipicamente retrato (3:4 ou 2:3), entao dentro de um quadrado com `object-contain`, a imagem renderizada fica como uma tira estreita — legivel apenas se o container for maior ou se adaptar a proporcao natural.

## Plano

### Acao 1: Corrigir containers de imagem no SimpleLinkCard e SortableLinkCard

**Standard cards**: Trocar `w-14 h-14 sm:w-16 sm:h-16` por `w-14 sm:w-16 flex-shrink-0` sem altura fixa. Remover `width={64} height={64}` do `<img>`. Usar `max-h-20` para limitar sem forcar quadrado. A imagem exibe na proporcao natural.

**Featured cards**: Trocar `w-20 h-20 sm:w-24 sm:h-24` por `w-20 sm:w-24 flex-shrink-0` com `max-h-28`. Remover `width={96} height={96}`.

Em ambos os casos, manter `object-contain` e `bg-muted/20`.

### Acao 2: Documentar regra "nunca cortar" no imageUtils.ts

Adicionar comentario de regra no topo do arquivo:

```
/**
 * REGRA DE OURO: NUNCA cortar imagens. Todas as transformacoes devem
 * apenas redimensionar (preservando proporcao) ou converter formato (webp).
 * Usar sempre object-contain no CSS. Nunca object-cover em thumbnails.
 */
```

### Acao 3: Manter getThumbnailUrl com width=160

O parametro `width=160` do Bunny Optimizer **redimensiona proporcionalmente** (nao corta). Isso esta correto e seguro. O problema nao e o CDN, e o container CSS quadrado que desperdicava espaco com imagens retrato.

### Acao 4: Lazy-load Index + remover charts do manualChunks (do plano anterior)

- `App.tsx`: `const Index = lazy(() => import("./pages/Index"))` 
- `vite.config.ts`: remover `'charts': ['recharts']` do manualChunks

### Arquivos alterados

- `src/components/links/SimpleLinkCard.tsx` — containers flexiveis
- `src/components/links/SortableLinkCard.tsx` — idem
- `src/lib/imageUtils.ts` — documentar regra
- `src/App.tsx` — lazy-load Index
- `vite.config.ts` — remover charts chunk

