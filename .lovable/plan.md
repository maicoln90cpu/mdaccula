

## Problema

O modal de edicao usa `object-cover` com dimensoes fixas (64x64px standard, 160x160px featured) e a imagem fica perfeita — preenche o espaco sem distorcao. Na pagina /links, os cards usam `object-contain` com `h-auto`, o que faz imagens retrato ficarem enormes verticalmente e imagens paisagem ficarem pequenas.

## Solucao

Aplicar exatamente a mesma regra do modal: container com largura E altura fixas + `object-cover`. Isso garante que toda imagem preenche o espaco uniformemente, independente da proporcao original.

### Alteracoes em SimpleLinkCard.tsx e SortableLinkCard.tsx

**Standard cards** — container e imagem:
- Container: `w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden`
- `<img>`: `w-full h-full object-cover`

**Featured cards** — container e imagem:
- Container: `w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden`
- `<img>`: `w-full h-full object-cover`

Remove `bg-muted/20` desnecessario e alinha com o comportamento exato do preview no modal.

### Arquivos
- `src/components/links/SimpleLinkCard.tsx`
- `src/components/links/SortableLinkCard.tsx`

