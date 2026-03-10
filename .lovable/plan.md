

## Problema

O `object-cover` faz a imagem **preencher** o quadrado inteiro, cortando (zoom) as partes que excedem. Por isso a imagem do Universo Paralello aparece "com zoom altissimo" — ela e mais larga que alta, entao o `object-cover` recorta as laterais para preencher o container 64x64.

No modal, a mesma imagem parece "inteira" porque o container do preview tem proporcoes diferentes (mais largo), entao o corte e menos perceptivel.

## Solucao

Trocar `object-cover` por `object-contain` no componente `LinkCardImage.tsx`. Isso faz a imagem inteira caber dentro do quadrado, sem corte, adaptando-se proporcionalmente. Adicionar `bg-white/10` ao container para que o espaco vazio (quando a imagem nao e quadrada) tenha um fundo sutil.

### Alteracao unica em `LinkCardImage.tsx`

**Container** (linha 55):
- Adicionar `bg-white/10` para fundo nos espacos vazios

**`<img>`** (linha 62):
- De: `object-cover`
- Para: `object-contain`

Isso e uma unica alteracao em um unico arquivo. Como `SimpleLinkCard`, `SortableLinkCard` e `CustomLinkForm` todos usam `LinkCardImage`, a mudanca propaga automaticamente para todos os lugares.

### Atualizar documentacao

- Atualizar o comentario do `LinkCardImage.tsx` (linha 27): de `object-cover` para `object-contain`

### Arquivos
- `src/components/links/LinkCardImage.tsx` (unico arquivo)

