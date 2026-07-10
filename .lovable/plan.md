
# Onda C.1 — Polimento do Editor de E-mails

Foco: **corrigir bugs de UI** e **aumentar personalização por bloco**, sem mexer em backend/E-goi. Deploy em 5 sub-etapas seguras.

## Diagnóstico dos problemas

### 1) CTA no "Template (marca)" não muda o preview
Quando o **Editor de blocos** já tem um bloco `cta_button` com `label` próprio, o render usa `block.label || settings.cta_label`. Ou seja, o campo "Texto do botão principal" da aba Marca **é sobrescrito** pelo label do bloco. Isso é o comportamento correto, mas hoje **não é explicado** ao usuário e dá impressão de bug.

### 2) Redes sociais fixas (Instagram/YouTube/TikTok) na aba Marca
Legado. Hoje o bloco `social_icons` do editor já suporta 6 redes com toggle e URL individual. Manter os 3 campos fixos duplica configuração e confunde.

### 3) "Blocos visíveis" (subtítulo/descrição/social/link secundário) na aba Marca
Legado. Cada um agora é um bloco no editor, que pode ser adicionado/removido/reordenado. **Redundante.**

### 4) "HTML customizado (avançado)"
São dois campos livres (`custom_html_header` e `custom_html_footer`) que injetam HTML **antes da logo** e **depois do rodapé**. Serve para colar coisas como "Newsletter #12 · Maio 2026" no topo, ou razão social/CNPJ no final. Hoje já pode ser substituído por um bloco `text` na posição desejada. Vou manter, mas explicar melhor no rótulo.

### 5) Tela pisca e volta para a aba "Configuração"
`<Tabs defaultValue="config">` é **não controlado**. Toda vez que uma ação chama `loadAll()` (salvar template, toggle digest, etc.), `setLoading(true)` desmonta o `<Tabs>` inteiro e ao remontar volta ao default. Fix: controlar o valor da aba em `useState` e **não desmontar** os Tabs durante o refresh (mostrar spinner interno em vez de troca completa de tela).

### 6) Preview do slider "Largura máxima" da Imagem com link
O `<img>` usa `width:100%; max-width:{maxW}px`. Enquanto o `maxW` for **maior** que a largura útil do container (~552px), visualmente nada muda. Slider vai de 200–600, então só valores abaixo de ~500 mostram diferença. **Não é bug**, é limite físico do container. Vou:
- limitar o slider a 200–552;
- adicionar controle de **alinhamento** (esquerda/centro/direita) que muda de fato o preview em qualquer largura.

### 7) "Erro ao gerar rascunho do digest semanal — Failed to send a request to the Edge Function"
Função `weekly-digest-draft` provavelmente ainda não foi deployada (foi criada na B.11 mas não vi confirmação de deploy). Vou redeployar e verificar logs.

## Sub-etapas (deploy em fases)

### C.1.1 — Fix do flicker de abas
- Controlar `<Tabs value=... onValueChange=...>` em `EmailConfig.tsx`.
- Remover o `if (loading) return spinner` que desmonta tudo. Mostrar spinner apenas dentro das abas afetadas.
- **Ganho:** trocar de aba, salvar, alternar toggle — nada mais volta pra "Configuração".

### C.1.2 — Limpeza da aba "Template (marca)"
- **Remover** cards: "Blocos visíveis", "Instagram/YouTube/TikTok URL" (o bloco social_icons cuida disso).
- **Manter**: Marca (logo + nome), Cores, Texto do CTA/link secundário/rodapé, HTML customizado.
- Renomear "HTML customizado (avançado)" → "HTML no topo e no rodapé (opcional)" com descrição em português leigo.
- **Adicionar aviso** no card "Textos e links": *"Se o Editor de blocos tem um botão CTA com texto próprio, ele tem prioridade sobre este campo."*
- **Ganho:** uma fonte de verdade por configuração, sem duplicação.

### C.1.3 — Personalização por bloco (item a item)
Auditoria bloco por bloco, adicionando propriedades editáveis + garantindo que o preview reflete cada mudança:

| Bloco | Novas propriedades |
|---|---|
| header (cabeçalho) | ✓ altura logo já existe. Adicionar: alinhamento (esq/centro/dir), padding vertical |
| eyebrow (etiqueta) | texto ✓. Adicionar: cor (usa primary por padrão), alinhamento |
| title (título) | Adicionar: tamanho (24/28/32/40px), alinhamento, cor |
| subtitle | Adicionar: alinhamento, cor |
| event_meta (data/hora/local) | Adicionar: layout (2 colunas / empilhado) |
| description | Adicionar: alinhamento, cor do texto |
| article_summary | Adicionar: mostrar/ocultar imagem da matéria |
| cta_button | label ✓, url_field ✓. Adicionar: largura (full/auto), alinhamento (auto/esq/centro/dir), cor de fundo (auto usa gradiente, ou cor fixa) |
| secondary_link | label ✓, url ✓. Adicionar: alinhamento |
| image_with_link | url/link/alt ✓. Ajustar slider p/ 200–552. Adicionar: alinhamento, borda arredondada (0/8/16px) |
| divider | Adicionar: espessura (1/2/4px), cor |
| text (HTML livre) | html ✓. Adicionar: alinhamento, cor base |
| social_icons | ✓ completo, adicionar: estilo (texto atual / pílulas coloridas) |
| footer | texto ✓, unsubscribe ✓. Adicionar: alinhamento |
| hero_image (flyer) | Adicionar: largura máxima (400–600), borda arredondada |

Cada opção usa design tokens existentes. Preview atualiza via `useMemo` já implementado — só preciso plugar as novas props no `renderBlock`.

- **Ganho:** flexibilidade real por template, sem mexer em código a cada nova campanha.

### C.1.4 — Deploy e teste do `weekly-digest-draft`
- Confirmar que o edge function foi deployado (`supabase--deploy_edge_functions`).
- Testar via `supabase--curl_edge_functions` com `{ force: true }`.
- Ler logs para diagnosticar erro real caso persista.

### C.1.5 — Validação manual (checklist)
Vou te entregar um checklist com 15 itens: alternar cada aba, salvar, gerar digest, editar cada bloco novo, ver preview atualizar.

## Riscos e mitigação

- **Risco:** remover campos da aba "Marca" pode apagar dados salvos (redes sociais URL).
  **Mitigação:** os campos ficam no banco (`email_template_settings`) mas somem da UI. Se um dia quiser voltar, os valores estão lá. Alternativamente, migro pro bloco social_icons do template padrão automaticamente (opcional — pergunto se quer).

- **Risco:** novas props de bloco em templates antigos.
  **Mitigação:** todo campo novo tem default; blocos existentes continuam renderizando igual.

- **Risco:** Tabs controlado pode ter regressão de acessibilidade.
  **Mitigação:** shadcn Tabs suporta controlado nativamente, sem mudança de API.

## Ordem de execução recomendada

1. **C.1.1** (flicker) — deploy independente, fix rápido.
2. **C.1.4** (digest) — deploy independente, fix rápido.
3. **C.1.2** (limpeza aba Marca) — deploy independente.
4. **C.1.3** (personalização por bloco) — maior, faço tudo em uma rodada mas com testes bloco a bloco.
5. **C.1.5** (checklist final).

## Pendências propositais (fora do escopo)

- Migrar `instagram_url/youtube_url/tiktok_url` do settings para o bloco social_icons do template padrão. (Faço se pedir.)
- Salvamento automático (autosave) no editor de blocos.
- Copiar bloco entre templates diferentes.

## Prevenção de regressão

- Nenhum caminho de disparo real (Enviar agora, A/B, Virada de lote, Digest) é tocado — só UI de edição e o renderer HTML.
- Todo bloco novo tem valor default retro-compatível.
- Testes de contrato existentes de e-mail seguem verdes (não usam props novas).

Pode aprovar essa Onda C.1 para eu começar pela C.1.1 (fix do flicker)?
