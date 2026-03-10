

## Explicacao dos parametros

### `quality=75`
Controla a compressao da imagem servida pelo Bunny CDN Optimizer. O valor vai de 1 a 100:
- **100** = sem compressao adicional, qualidade maxima, arquivo maior
- **75** (atual) = compressao moderada, boa qualidade, arquivo ~40-60% menor
- **50** = compressao agressiva, qualidade aceitavel, arquivo ~60-75% menor
- **25** = compressao muito agressiva, perda visivel de nitidez, arquivo ~80% menor

Para thumbnails pequenas (64x64px na tela), quality=50 seria visualmente indistinguivel de 75.

### `width=160`
Forca o Bunny CDN a redimensionar a imagem para 160px de largura antes de entregar. Isso significa que o navegador recebe uma imagem de 160px de largura, independente do tamanho original.

**Este e o problema.** O container do card e `w-16` = 64px CSS. Com `object-contain`, a imagem de 160px e encaixada dentro de 64x64. Para imagens quadradas funciona bem. Para imagens retangulares (flyers de eventos sao tipicamente 3:4 ou 4:3), o `width=160` forca uma proporcao que depois precisa ser re-adaptada pelo browser dentro do quadrado, causando inconsistencias visuais dependendo do aspect ratio original.

### O que muda removendo `width=160`
- O browser recebe a imagem no tamanho original (ex: 1200x800px) e faz o downscale localmente
- A imagem fica mais fiel ao original dentro do container
- O arquivo sera maior (mais banda), mas como ja esta em WebP e passa pelo CDN com cache de 1 ano, o impacto e minimo

### Plano de alteracao

**Arquivo:** `src/lib/imageUtils.ts`

1. Em `getOptimizedImageUrl`: mudar `quality=75` para `quality=85` (melhor qualidade para flyers com texto)
2. Em `LinkCardImage.tsx` (linha 42): trocar `getThumbnailUrl(rawImage)` por `getOptimizedImageUrl(rawImage)` — isso remove o `width=160` dos cards de /links, entregando a imagem no tamanho original com apenas compressao de qualidade

Isso elimina a distorcao causada pelo redimensionamento forcado no servidor e mantem a otimizacao de compressao.

### Alternativa mais conservadora
Manter `getThumbnailUrl` mas aumentar o width para 256 (4x o container de 64px, suficiente para telas retina) em vez de remover completamente. Isso preserva economia de banda mas com qualidade muito melhor.

