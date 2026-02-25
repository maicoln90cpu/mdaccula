

## Diagnostico: imagens "espremidas" nos cards

### Causa raiz

A diferenca entre a pagina de detalhe (que funciona) e as listagens (que estao quebradas) e o uso de `object-contain` nos cards.

**EventDetail (funciona)**: container alto (`h-[40vh]`) + `object-contain` = imagem vertical tem espaco para mostrar inteira.

**Cards de listagem (quebrado)**: containers pequenos (`aspect-square`, `aspect-video`) + `object-contain` = imagem vertical fica minuscula, "espremida" dentro do container, com espacos vazios dos lados.

O problema foi introduzido quando trocamos `object-cover` por `object-contain` nos cards para "evitar corte". Mas em cards de listagem, `object-cover` e o padrao correto — ele preenche o container e corta apenas as bordas, mantendo o layout consistente. `object-contain` so faz sentido em paginas de detalhe onde o container e grande o suficiente.

### Plano de correcao

**Regra**: cards usam `object-cover` (preenche, corta bordas). Paginas de detalhe usam `object-contain` (mostra tudo).

| Arquivo | Linha | De | Para |
|---------|-------|----|------|
| `src/pages/Eventos.tsx` | 567-571 | `aspect-square` + `max-w-full max-h-full object-contain` | `aspect-[3/4]` + `w-full h-full object-cover` |
| `src/pages/Blog.tsx` | 472-476 | `aspect-video` + `max-w-full max-h-full object-contain` | `aspect-video` + `w-full h-full object-cover` |
| `src/pages/Blog.tsx` | 393-397 | featured post `max-w-full max-h-full object-contain` | `w-full h-full object-cover` |
| `src/components/sections/FeaturedEvents.tsx` | 117 | `objectFit="contain"` | `objectFit="cover"` |
| `src/pages/EventDetail.tsx` | 240 | `object-contain` | manter como esta (funciona) |
| `src/components/links/SortableLinkCard.tsx` | 136, 170 | ja usa `object-cover` | manter como esta |

**Detalhe para Eventos**: trocar `aspect-square` por `aspect-[3/4]` nos cards de evento. Isso da mais espaco vertical para flyers (que sao quase sempre verticais), e com `object-cover` a imagem preenche o card de forma bonita sem distorcer.

**Detalhe para Blog**: manter `aspect-video` (16:9) porque imagens de blog sao geralmente horizontais. Trocar para `object-cover` para preencher o container.

### Arquivos modificados

1. `src/pages/Eventos.tsx` — container `aspect-[3/4]` + img `w-full h-full object-cover`
2. `src/pages/Blog.tsx` — featured e grid: img `w-full h-full object-cover`
3. `src/components/sections/FeaturedEvents.tsx` — `objectFit="cover"`

Total: 3 arquivos, mudancas pontuais de CSS apenas.

