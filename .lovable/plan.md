

## Problema

O container de imagem tem dimensoes fixas quadradas (`w-14 h-14` / `w-16 h-16`). Com `object-contain`, imagens retrato (flyers verticais) sao reduzidas para caber no quadrado — ficam minusculas e "espremidas". No modal de edicao, a imagem nao tem essas restricoes e aparece corretamente.

## Solucao

Remover a altura fixa do container. Manter apenas largura fixa e deixar a altura se adaptar a proporcao natural da imagem.

### Alteracoes em SimpleLinkCard.tsx e SortableLinkCard.tsx

**Standard cards** — container de imagem:
- De: `w-14 sm:w-16 h-14 sm:h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted/20 flex items-center justify-center`
- Para: `w-14 sm:w-16 flex-shrink-0 rounded-md bg-muted/20`
- `<img>`: de `w-full h-full object-contain` para `w-full h-auto object-contain rounded-md`

**Featured cards** — container de imagem:
- De: `w-20 sm:w-24 h-20 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted/20 flex items-center justify-center`
- Para: `w-20 sm:w-24 flex-shrink-0 rounded-lg bg-muted/20`
- `<img>`: de `w-full h-full object-contain` para `w-full h-auto object-contain rounded-lg`

Isso faz a imagem ocupar toda a largura do container e a altura se ajustar proporcionalmente — exatamente como aparece no preview do modal.

### Arquivos
- `src/components/links/SimpleLinkCard.tsx`
- `src/components/links/SortableLinkCard.tsx`

