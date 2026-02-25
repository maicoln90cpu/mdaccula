
Objetivo: encerrar de vez o problema de imagens cortadas/esticadas e corrigir a /links (layout quebrado com mídia gigante), com regra única no site inteiro: imagem sempre inteira, sem crop, centralizada, aceitando espaço vazio.

Diagnóstico consolidado (com validação no código atual)

- Do I know what the issue is? Sim.
- Causa 1 (/links quebrada visualmente): em `src/components/links/SortableLinkCard.tsx` existe classe inválida `w-22 h-22` (não existe no Tailwind padrão). Resultado: a imagem fica no tamanho natural (gigante), empurra o texto e deforma o card.
- Causa 2 (cortes aparentes em blog/eventos): ainda há combinações que anulam o objetivo “sem corte”:
  - `object-cover` remanescente em pontos de card
  - `group-hover:scale-*` aplicado na própria imagem (com `overflow-hidden`, gera corte no hover)
  - containers com proporção fixa inadequada para imagens muito verticais (ex.: flyers em caixas tipo video)
- Causa 3 (inconsistência de comportamento): regra de renderização de imagem não está 100% centralizada num padrão único; cada página ajusta de um jeito.

Plano de correção definitiva (implementação)

Bloco A — Consertar /links imediatamente (visual e proporção)

1) `src/components/links/SortableLinkCard.tsx`
- Trocar `w-22 h-22` por tamanho válido e fixo pequeno (ex.: `w-14 h-14 sm:w-16 sm:h-16`).
- Trocar `rounded-s` por `rounded-md`/`rounded-lg` válido e consistente.
- Trocar imagem de destaque de `object-cover` para `object-contain`.
- Adicionar wrapper fixo para thumb (`bg-black/20`, `overflow-hidden`, `flex items-center justify-center`) para manter imagem pequena ao lado do texto.
- Aplicar limites seguros para dimensões vindas do banco:
  - `card_width` com clamp (mín/máx)
  - `card_height` com clamp para card normal
  Isso evita qualquer card “explodir” por valor extremo.

Resultado esperado: cards de links voltam ao formato compacto (como no print de referência), com imagem pequena lateral e sem corte.

Bloco B — Regra global “sem corte” em conteúdo público

Padronizar em todos os pontos de conteúdo:
- imagem: `object-contain`
- wrapper: `bg-muted/20`, `flex items-center justify-center`, `overflow-hidden`
- remover zoom na própria imagem (`group-hover:scale-*`) onde houver risco de crop

Arquivos alvo:
- `src/pages/Blog.tsx`
- `src/pages/BlogPost.tsx`
- `src/pages/Eventos.tsx`
- `src/pages/EventDetail.tsx`
- `src/components/events/EventsCarousel.tsx`
- `src/components/events/EventModal.tsx`
- `src/components/sections/FeaturedEvents.tsx`
- `src/components/sections/LatestNews.tsx`
- `src/components/links/SortableLinkCard.tsx`

Ajustes específicos:
- Blog listagem (`Blog.tsx`): trocar moldura rígida “video-like” por altura fixa equilibrada (não crop) para flyers verticais não parecerem “fatia”.
- Eventos (`Eventos.tsx`): remover scale na imagem do card (hoje pode cortar no hover em alguns casos).
- Relacionados em `EventDetail.tsx`: remover scale da imagem mantendo contain.

Bloco C — Imagem do artigo de blog “metade do tamanho”

1) `src/pages/BlogPost.tsx`
- Reduzir mais o bloco principal da imagem:
  - de `max-w-2xl` para `max-w-xl` (desktop)
  - reduzir limite vertical (ex.: `max-h-[42vh]`)
- manter centralização e `object-contain`.

Resultado: imagem principal claramente menor (aprox. metade visual do estado anterior), sem cortar.

Bloco D — Hardening do pipeline de URL de imagem

1) `src/lib/imageUtils.ts`
- Manter CDN + `quality=75` (sem width/height/resize).
- Endurecer para legado:
  - se URL vier com params antigos (`width`, `height`, `resize`) remover esses params e preservar só os permitidos (`quality`).
  - evitar duplicar `quality`.
- Isso garante que nenhum link antigo volte a forçar crop.

Critérios de aceite (E2E)

1) /links
- cards compactos
- thumb pequena lateral (não gigante)
- título/subtítulo legíveis, sem coluna “espremida”
- sem corte/sem distorção

2) /blog (grid + destaque)
- imagem inteira em todos os cards
- sem corte lateral
- sem zoom que recorta imagem

3) /blog/:slug (exemplo citado)
- imagem principal menor (meta “metade”)
- inteira, centralizada, sem crop

4) /eventos e /eventos/:slug
- manter comportamento correto já obtido
- confirmar que “caso isolado” também não corta mais

5) Responsivo
- validar mobile + desktop nas rotas: `/links`, `/blog`, `/blog/:slug`, `/eventos`, `/eventos/:slug`.

Risco e mitigação

- Risco: com `contain`, haverá áreas vazias em imagens com proporções extremas.
- Mitigação: padronizar fundo do wrapper (`bg-muted/20`) e altura de moldura por contexto, garantindo visual consistente sem crop.

Entregável final esperado

- Sem corte de imagem em todo o site (regra única e consistente).
- /links estabilizada com thumbnails pequenas ao lado do texto.
- Imagem de artigo menor no desktop, conforme pedido.
- Pipeline de URL blindado contra params legados que causam corte.
