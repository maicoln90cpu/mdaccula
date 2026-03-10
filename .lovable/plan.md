

## Problema

Ao remover `overflow-hidden` e `max-h` dos containers de imagem, imagens retrato (como Warehouse) expandem o card inteiro, quebrando o alinhamento. Cards como D.Edge e Piknic ficam compactos porque suas imagens sao mais quadradas.

## Solucao

Adicionar altura fixa ao container de imagem **com** `overflow-hidden`, mas manter `object-contain` na tag `<img>`. Isso garante:
- Container com tamanho consistente em todos os cards
- Imagem redimensionada proporcionalmente dentro do container (sem corte)
- Cards alinhados e uniformes

### Alteracoes em ambos os arquivos (SimpleLinkCard.tsx e SortableLinkCard.tsx)

**Standard cards** — container de imagem:
```
w-14 sm:w-16 h-14 sm:h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted/20 flex items-center justify-center
```

**Featured cards** — container de imagem:
```
w-20 sm:w-24 h-20 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted/20 flex items-center justify-center
```

A `<img>` continua com `w-full h-full object-contain` — a imagem escala para caber no container sem cortar, com espaco vazio (letterbox) se a proporcao for diferente.

**Nota**: `object-contain` + container fixo **nao corta**. A imagem inteira fica visivel, apenas menor. Isso respeita a regra de ouro.

### Arquivos
- `src/components/links/SimpleLinkCard.tsx`
- `src/components/links/SortableLinkCard.tsx`

