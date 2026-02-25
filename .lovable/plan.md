

## Correcao: build quebrado + Image Transformation inteligente

### Problema 1: Build quebrado

`SortableLinkCard.tsx` linha 5 ainda importa `IMAGE_PRESETS` que foi removido de `imageUtils.ts`. E na linha 89 passa segundo argumento para `getOptimizedImageUrl`.

**Fix**: Remover `IMAGE_PRESETS` do import e chamar `getOptimizedImageUrl(rawImage)` sem segundo argumento.

### Problema 2: Image Transformation inteligente (quality only)

O usuario quer reativar otimizacao mas apenas reduzindo qualidade, sem forcar dimensoes (que causava distorcao). A logica sera:

- Manter reescrita de dominio Supabase → Bunny CDN
- Adicionar apenas `?quality=75` na URL (sem width/height/resize)
- Isso reduz tamanho do arquivo sem alterar proporcoes

**Mudanca em `imageUtils.ts`**:
```
return `${BUNNY_CDN_HOST}/${imagePath}?quality=75`;
```

### Arquivos modificados

1. **`src/components/links/SortableLinkCard.tsx`** — Remover `IMAGE_PRESETS` do import (L5) e do uso (L89)
2. **`src/lib/imageUtils.ts`** — Adicionar `?quality=75` na URL retornada (L44)

Total: 2 arquivos, mudancas minimas.

