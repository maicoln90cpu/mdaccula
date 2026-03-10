

## Analise do novo relatorio PageSpeed (score 51)

### Problemas identificados nos screenshots

| Problema | Impacto | Economia |
|----------|---------|----------|
| **Imagens de thumbnail oversized** | LCP, bandwidth | **2.166 KiB** |
| Cache lifecycle insuficiente | Repeat visits | 530 KiB |
| Legacy JS (target esnext) | Parse time | 47 KiB |
| JS execution (GTM+Facebook) | TBT 1.5s | ~750ms (terceiros) |
| Main thread work | TBT 2.2s | ~500ms |
| Unused JS | Bundle | 320 KiB |
| Charts chunk na /links | TBT | 69ms |

### O problema principal: imagens de thumbnail

O PageSpeed mostra que as imagens dos cards sao **960x1280 pixels** mas exibidas a **74x98 pixels**. Cada imagem pesa ~244 KiB quando poderia pesar ~10-15 KiB. Sao ~10 imagens visíveis = **2.1 MB desperdicados**.

O codigo atual em `imageUtils.ts` **remove** parametros `width` e `height` da URL (linhas 50-53). Isso foi feito para evitar cortes, mas agora impede o redimensionamento de thumbnails.

A solucao: criar uma funcao `getThumbnailUrl` que adiciona `?width=160` ao URL do CDN. O Bunny Optimizer (que ja esta ativo, pois `?quality=75` funciona) redimensiona on-the-fly.

---

### Plano de implementacao (4 acoes)

**Acao 1: Criar `getThumbnailUrl` em imageUtils.ts (MAIOR IMPACTO: -2.1 MB)**

Nova funcao que chama `getOptimizedImageUrl` e adiciona `&width=160` ao final. Usada apenas em thumbnails pequenas (w-14 a w-24 = 56-96px CSS = ~160px em tela 2x).

A funcao `getOptimizedImageUrl` continua inalterada (sem quebrar nada).

**Acao 2: Usar `getThumbnailUrl` no SimpleLinkCard.tsx**

Nas duas tags `<img>` de thumbnail (linhas 100 e 124), trocar `getOptimizedImageUrl(rawImage)` por `getThumbnailUrl(rawImage)`. Adicionar `width` e `height` HTML explicitos para evitar layout shift.

Manter `getOptimizedImageUrl` no avatar da pagina /links (que e exibido grande).

**Acao 3: Corrigir target de build para `es2020` (elimina "Legacy JS" -47 KiB)**

Em `vite.config.ts` linha 59, trocar `target: 'esnext'` por `target: 'es2020'`. O `esnext` nao gera polyfills, mas o PageSpeed detecta patterns que poderiam ser mais modernos. O `es2020` e o sweet spot entre compatibilidade e tamanho.

**Acao 4: Usar `getThumbnailUrl` tambem no SortableLinkCard (admin)**

Para manter consistencia e performance tambem para o admin.

---

### O que NAO vou mexer (e por que)

- **GTM (768ms) + Facebook (285ms)**: sao scripts de terceiros, ja adiados com requestIdleCallback. Nao ha mais o que fazer no codigo — o proprio Google penaliza o GTM dele mesmo no PageSpeed.
- **Unused JS (320 KiB)**: a maior parte e do react-vendor e ui-vendor que sao necessarios para qualquer pagina. O dnd-kit ja esta lazy. Os 320 KiB restantes sao do core do React + Router + Radix.
- **Charts chunk (69ms)**: carrega por causa do manualChunks do Vite que faz preload. Impacto minimo (69ms). Corrigir exigiria reestruturar o chunk splitting inteiro.
- **Cache lifecycle (530 KiB)**: e sobre headers HTTP do servidor, nao do codigo. Precisa configurar Cache-Control no Lovable/Cloudflare, nao no source.

### Impacto esperado

```text
Acao                          | Metrica    | Ganho
------------------------------|------------|------
1-2. Thumbnail resize         | LCP, Size  | -2.1 MB (!)
3. Build target es2020        | Parse time | -47 KiB
4. SortableLinkCard thumbnails| Size       | -200 KiB (admin)
------------------------------|------------|------
Score estimado: 51 → 70-80
```

A acao 1-2 sozinha representa **95% do ganho possivel**. As imagens sao de longe o maior problema restante.

