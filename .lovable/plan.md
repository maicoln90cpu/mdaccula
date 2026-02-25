

## Analise completa das imagens

### Verificacao no banco + CDN + preview

Verifiquei cada URL citada diretamente:

1. **Banco de dados**: as `image_url` estao corretas (URLs Supabase Storage originais, sem params de resize)
2. **CDN (Bunny)**: a transformacao `?quality=75` funciona e retorna a imagem **INTEIRA** (confirmado via fetch direto com screenshot)
3. **Preview do Lovable (browser sandbox)**: artigo do Piknic Electronik mostra imagem **INTEIRA, sem corte** com `object-contain`
4. **URL publicada (mdaccula.lovable.app)**: tambem mostra imagem **inteira, sem corte**

### Causa raiz do que voce esta percebendo

O problema NAO e corte de imagem propriamente dito. O codigo ja usa `object-contain`. O que acontece e:

- Os cards do grid do `/blog` usam `aspect-video` (16:9) como container
- Quando a imagem e vertical (flyer, ex.: Piknic = 864x1080), ela fica **comprimida dentro da caixa 16:9** com barras escuras nas laterais
- Visualmente, parece "cortada" porque a imagem ocupa apenas ~40% da largura do card, com espacos enormes
- Isso e especialmente ruim em flyers verticais que sao a maioria do conteudo

### Solucao escolhida: Layout lateral (imagem ao lado do texto)

Voce escolheu o formato de **imagem lateral**, igual ao `/links`. Isso resolve o problema porque:

- A imagem ganha uma area vertical adequada (nao precisa caber numa caixa 16:9)
- Flyers verticais exibem naturalmente sem desperdicar espaco
- Imagens horizontais (AI-generated) tambem ficam bem com `object-contain`

## Plano de implementacao

### 1. Blog grid cards (`src/pages/Blog.tsx`, linhas 465-529)

Trocar o layout vertical (imagem em cima + texto embaixo) por layout horizontal:

```
De:
  Card vertical
    [aspect-video image]
    [title]
    [excerpt]
    [meta]

Para:
  Card horizontal (flex-row)
    [imagem fixa w-32 sm:w-40 h-auto, object-contain, bg-muted/20]
    [coluna direita: title + excerpt + meta + botao]
```

Detalhes:
- Imagem: wrapper fixo `w-32 sm:w-40 lg:w-48` com `min-h-[120px]`, `flex-shrink-0`, `bg-muted/20`, `overflow-hidden`, `rounded-l-lg`
- Imagem tag: `w-full h-full object-contain`
- Badge de categoria: posicionada sobre a imagem (absolute)
- Texto: `flex-1 p-4` com title (line-clamp-2), excerpt (line-clamp-2), meta e botao
- Responsivo: mobile fica `flex-col` (imagem em cima com altura menor), desktop fica `flex-row`

### 2. Featured post (linhas 391-449)

Ja esta em formato lateral (grid-cols-2). Manter como esta, apenas garantir que o container de imagem tenha `min-h-[200px]` para flyers verticais nao ficarem esmagados.

### 3. BlogPost hero image (ja ajustado)

Manter `max-w-xl` + `max-h-[42vh]` + `object-contain` (ja esta funcionando corretamente).

### 4. Nenhuma mudanca em imageUtils.ts

O pipeline CDN esta correto. As imagens chegam inteiras, o problema era apenas CSS do grid.

## Resultado esperado

- Cards do blog com imagem lateral, leitura limpa, flyers inteiros visiveis
- Sem "barras pretas" ou sensacao de imagem cortada
- Layout semelhante ao `/links` (compacto, imagem ao lado do texto)
- Responsivo: mobile empilha verticalmente, desktop fica lado a lado

