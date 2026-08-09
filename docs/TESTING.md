# Testes — guia de uso e catálogo

Este projeto usa **Vitest** (unitários, integração, contratos), **Playwright** (E2E) e **Deno** (Edge Functions).

## Como rodar

| Comando | O que faz | Quando usar |
|---|---|---|
| `npm test` | Roda todos os testes Vitest (rápido, sem coverage). | Antes de commitar. |
| `npm run test:watch` | Vitest em modo watch. | Enquanto escreve teste. |
| `npm run test:coverage` | Gera relatório de cobertura em `coverage/`. | Antes de PR grande. |
| `npm run test:coverage:ratchet` | Coverage + verifica que cobertura não caiu. | Igual ao que o CI roda. |
| `npm run test:ratchet` | Só o ratchet, assume coverage já gerado. | Debug do ratchet. |
| `npm run e2e` | Playwright, projeto `chromium` (precisa do app rodando). | Antes de release. |
| `npm run e2e:full` | Playwright full-site crawl (3 viewports, rotas + modais). | Manual / nightly, não bloqueante — ver seção abaixo. |
| `npm run test:edge` | Testes Deno das Edge Functions. | Após mexer em `supabase/functions/`. |

## Estrutura

```
src/__tests__/
├── architecture/   Guards estáticos (lê código-fonte com regex/AST).
├── components/     React Testing Library em componentes.
├── contracts/      Contratos HTTP de Edge Functions (skipIf sem env).
├── database/       Provas vivas de policies RLS contra o Supabase real.
├── hooks/          Hooks isolados com renderHook.
├── lib/            Funções puras.
├── pages/          Páginas montadas com providers.
├── regression/     Testes ligados a bugs catalogados abaixo.
└── seo/            Garantias de SEO (meta tags, robots, sitemap).
```

## Coverage ratchet

Arquivo `.coverage-ratchet.json` é a **baseline versionada**. Só sobe, nunca desce. Se cair >0,5pp, o CI bloqueia o merge.

- Subiu cobertura? O script atualiza a baseline e pede commit.
- Caiu cobertura? Adicione testes ou reverta o que removeu testes.

**Exceção registrada (16/07/2026)**: baseline ajustada manualmente de
`{lines:8.55, statements:8.1, functions:6.19, branches:6.24}` para
`{lines:8.11, statements:7.72, functions:5.45, branches:5.56}` após a reescrita de
`FontesManager.tsx` (unificação de fontes) e `EventWatchReview.tsx` (fluxo de 2 passos
gerar/publicar). Nenhuma página de admin no projeto tem teste de componente hoje (todas
em 0% — `BlogManager.tsx`, `LinksManager.tsx`, `TeamManager.tsx` etc.); os dois arquivos
reescritos seguem exatamente esse mesmo padrão, não uma regressão de disciplina de
teste. A queda é só o efeito do denominador crescendo (mais linhas de página de admin,
convencionalmente não testadas, no total do projeto). O comportamento novo
(`publishImmediately`, regeneração via `existingPostId`) foi verificado manualmente
contra a função implantada em produção antes deste ajuste — ver
`docs/superpowers/plans/2026-07-15-fontes-unificacao-e-fluxo-2-passos.md`.

## Contract tests (Edge Functions)

Estão em `src/__tests__/contracts/`. Cada arquivo testa **uma** Edge Function contra o ambiente real.

- Pulam automaticamente se `VITE_SUPABASE_URL` não estiver setado (não quebram CI sem secrets).
- Validam apenas o **contrato** (CORS, status codes, content-type, formato do envelope) — não o conteúdo de negócio.

Hoje cobertos: `indexnow-notify`, `sitemap`. As outras 29 funções herdam o mesmo template quando forem auditadas.

## RLS tests (Database)

Em `src/__tests__/database/`. Cada arquivo prova as políticas de Row-Level Security de UMA tabela contra o Supabase real.

- Pulam automaticamente se `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` faltarem.
- Não escrevem dados — só tentam e validam que a RLS bloqueia.
- Hoje cobertos: `events` (4 testes: SELECT permitido, INSERT/UPDATE/DELETE bloqueados pra anônimo).
- A esteira: replicar para `blog_posts`, `custom_links`, `user_roles`, `profiles`.

## Full-site crawl (viewport + modal), E2E

Suíte em `e2e/full-site/`, com 3 projetos Playwright dedicados em `playwright.config.ts`:
`viewport-mobile` (390×844), `viewport-tablet` (768×1024), `viewport-desktop` (1440×900).
Roda via `npm run e2e:full`, em job separado do CI (`e2e-full-site`, disparado por
`workflow_dispatch` ou cron noturno) — **não bloqueia PR/push**, ao contrário do job
`e2e` (que continua rodando só o projeto `chromium` em todo push/PR).

**Escopo:** cobertura abrangente, **guiada por registro**, de toda rota e todo modal
atualmente catalogados em `e2e/full-site/registries/{routes,modals}.ts`, nos 3
breakpoints acima. **Não é uma garantia permanente de "100% do site"** — se uma rota
ou modal novo não for adicionado ao registro, ele simplesmente não é testado.

**Convenção de manutenção:**
- Rota nova em `src/App.tsx` → adicionar uma entrada em `registries/routes.ts`.
- Dialog/AlertDialog/Sheet/Popover novo → adicionar em `registries/modals.ts`, ou
  documentar a exclusão em `SKIPPED_MODALS` com o motivo.

**Regra de segurança (mesmo banco de produção):** o login admin do E2E autentica no
MESMO projeto Supabase de produção (não há staging dedicado). Por isso, toda entrada
de admin em `modals.ts` abre o dialog e fecha via **Escape** — nunca clica em
Salvar/Confirmar/Excluir.

**Gaps conhecidos (documentados no próprio código, não omitidos silenciosamente):**
- Os 11 `AlertDialog` de confirmação destrutiva (excluir evento/post/link/membro/etc.)
  ficam fora do crawl — exigiriam uma linha de dado descartável em produção. Só
  reabilitar com uma fixture claramente nomeada por tabela.
- `EventModal` (`src/components/events/EventModal.tsx`) parece inalcançável hoje via
  UI pública: `Eventos.tsx` nunca chama `setShowEventModal(true)`, só navega para
  `/eventos/:slug`. Achado durante a implementação desta suíte — não corrigido aqui
  (fora do escopo), só documentado em `SKIPPED_MODALS`.
- `NewsletterPopup` é opcional/best-effort: depende de
  `site_settings.newsletter_popup_enabled` e o teste simula scroll >50% da página em
  vez de esperar os 30s reais do `setTimeout`; se o popup estiver desabilitado no
  ambiente, o teste pula (não falha).
- `TicketDayPickerModal` só existe quando o evento fixture tem `tickets_per_day=true`
  e é multi-dia — também opcional/best-effort.
- `/blog/:slug` não tem slug fixo: descoberto em runtime visitando `/blog` e clicando
  no primeiro link de post. `/links/:slug` e `/r/:slug` ficam fora do crawl (sem
  fixture documentada).
- "Novo Post" (BlogManager) e "Novo Template" (EventTemplates) renderizam o formulário
  inline na própria página, não em um Dialog — não entram no registro de modais (a
  página em si já é coberta pelo `route-crawl.spec.ts`).
- PodcastManager (detalhe de inscrição), NewsletterABResults (editar variante) e o
  dialog de "Enviar Email em Massa" do NewsletterManager só abrem com dado existente
  (linha selecionada ou lista de inscritos confirmados não-vazia) — fora do registro
  para não depender de estado de dados de produção.

## Regressões cobertas

Catálogo de bugs de produção que foram corrigidos e ganharam teste permanente. **Nunca remover daqui sem aprovação.**

### R-001 — Descrição/subtitle do evento some no modal e no slug
- **Quando:** junho/2026
- **Sintoma:** Salvar evento com descrição funcionava no banco, mas `/eventos` (modal) e `/eventos/:slug` mostravam vazio.
- **Causa:** `useEvents.ts` e `EventDetail.tsx` usavam `.select("...")` com string literal incompleta.
- **Correção:** Constante única `EVENT_PUBLIC_FIELDS` em `src/lib/eventSelectFields.ts`.
- **Proteção (3 camadas):**
  1. `src/__tests__/lib/eventSelectFields.test.ts` — campos obrigatórios presentes.
  2. `src/__tests__/architecture/event-select-fields.test.ts` — guard estático proíbe string literal.
  3. `src/__tests__/regression/event-description-persistence.test.ts` — cita o bug por nome.

### R-002 — Firecrawl quase nunca rodava na geração de artigo
- **Quando:** julho/2026
- **Sintoma:** Artigos de evento/editorial gerados pelo admin não recebiam contexto adicional de notícias (Firecrawl), mesmo com `FIRECRAWL_API_KEY` configurada e fontes ativas em `news_sources`.
- **Causa:** `generate-blog-post-v2/index.ts` só rodava o scraping `if (FIRECRAWL_API_KEY && remainingMs > 15000 && !generateImage)`. `generateWithImage` é `true` por padrão no admin (`AIContent2.tsx`) e é passado como `generateImage` em todos os fluxos de geração — a trava `!generateImage` bloqueava o scraping na quase totalidade das gerações reais. A condição era resquício de quando a geração de imagem bloqueava a resposta de texto; hoje a imagem roda em background (`EdgeRuntime.waitUntil`) e não depende mais do scraping ter terminado.
- **Correção:** decisão de scraping extraída para `shouldScrapeForContext()` em `supabase/functions/_shared/scrapeGate.ts`, cuja assinatura não recebe mais a flag de geração de imagem — torna a regressão impossível de reintroduzir sem quebrar o typecheck.
- **Proteção:** `supabase/functions/_shared/scrapeGate_test.ts` (Deno test, `npm run test:edge`) — cobre key ausente, tempo insuficiente e confirma que a decisão independe de `generateImage`.

### R-003 — "Marcar como enviado" no Controle Pessoal falhava (não era RLS)
- **Quando:** julho/2026
- **Sintoma:** Clicar em "Marcar enviado" na aba Controle Pessoal do admin de e-mails sempre falhava. Reportado inicialmente como "erro de RLS".
- **Causa:** `EmailPersonalControl.markManual()` grava `mode: "manual"` em `event_email_campaigns`, mas a CHECK constraint da coluna `mode` só permitia `('draft','immediate','scheduled')` desde a criação da tabela — o erro real era `violates check constraint "event_email_campaigns_mode_check"`, não RLS.
- **Correção:** `supabase/migrations/20260714120001_fix_manual_mode_check.sql` recria a constraint incluindo `'manual'`.
- **Proteção:** `src/__tests__/regression/email-manual-mode-constraint.test.ts` — garante que o valor gravado pelo frontend e o permitido pela constraint mais recente continuam sincronizados.

### R-004 — "Enviar agora" (Histórico) falhava com E-goi 422 `list_id.isEmpty`
- **Quando:** julho/2026
- **Sintoma:** Disparo imediato de campanha via botão "Enviar agora" retornava erro 422 da E-goi: `{"errors":{"list_id":{"isEmpty":"..."}}}`.
- **Causa:** `create-event-email-campaign/index.ts` inclui `list_id` corretamente na criação da campanha (`POST /campaigns/email`), mas a chamada seguinte que dispara o envio (`POST .../actions/send`) mandava corpo vazio `{}` — esse endpoint também exige `list_id`.
- **Correção:** o corpo da chamada de send passa a incluir `list_id: Number(cfg.list_id)`.
- **Proteção:** `src/__tests__/regression/egoi-send-missing-list-id.test.ts` — garante que a chamada `.../actions/send` nunca mais seja feita com corpo vazio.

### R-005 — Overflow horizontal em várias páginas/dialogs do admin em mobile/tablet
- **Quando:** julho/2026
- **Sintoma:** descoberto pela primeira execução real da suíte `e2e/full-site/` (ver seção acima) em 390px/768px: `document.documentElement.scrollWidth` excedia `clientWidth` em até 603px em `/admin/email-config`, além de `/admin/email-preview`, `/admin/egress-monitor`, `/admin/redirects`, `/admin/ai-prompt-templates`, `/admin/newsletter`, `/admin/blog`, e nas páginas públicas `/analytics` e `/links`. O dialog "Novo Link" (RedirectsManager) e "Novo Template" (PromptTemplatesManager) também vazavam horizontalmente.
- **Causa:** 3 componentes compartilhados sem tratamento responsivo:
  1. `TabsList` (`src/components/ui/tabs.tsx`) sem `overflow-x-auto`/`max-w-full` — `EmailConfig` (8 abas) e `EgressMonitor` (2 `TabsList`) estouravam a largura sozinhos.
  2. `Navigation` desktop (`src/components/ui/navigation.tsx`) sem `flex-wrap`, email do usuário sem truncar — vira `md:flex` exatamente em 768px (o breakpoint de tablet testado) e não cabia com todos os itens + email.
  3. `DialogContent` (`src/components/ui/dialog.tsx`) usava `w-full` sem margem de segurança nem `overflow-x-hidden` — qualquer `grid-cols-2` não-responsivo dentro do dialog vazava.
  Mais bugs pontuais: grid de 2 colunas fixo nos dialogs de UTM (RedirectsManager/PromptTemplatesManager), iframe de preview com largura fixa de 600px sem `min-w-0` no `Card` pai (EmailPreview), linhas de botão sem `flex-wrap` (NewsletterManager/BlogManager), eixo de gráfico Recharts sem `overflow-hidden` no wrapper (Analytics), card destacado sem `truncate` (SimpleLinkCard/Links).
- **Correção:** fix na raiz dos 3 componentes compartilhados (tabs.tsx, navigation.tsx, dialog.tsx) + fix pontual em cada página listada acima (grids `grid-cols-1 sm:grid-cols-2`, `flex-wrap`, `truncate`, `min-w-0`).
- **Proteção:** a própria suíte `e2e/full-site/route-crawl.spec.ts` e `modal-crawl.spec.ts` — que foi o que encontrou o bug — é a proteção permanente: qualquer regressão de overflow nessas páginas/dialogs (ou em qualquer rota/modal já registrado) volta a falhar `npm run e2e:full` nos 3 viewports. Não há teste Vitest separado porque overflow de layout real depende de renderização de browser, que jsdom não reproduz de forma confiável — E2E é a ferramenta correta aqui, não um substituto de conveniência.
- **Nota:** o timeout de `admin-events-create-dialog` (e as demais falhas de timeout de 60s vistas numa primeira execução real com credencial de admin) foram causadas por contenção de workers em paralelo local contra o mesmo Vite dev server + dados reais de produção — confirmado via logs do Supabase Auth (0 rate-limit, 100% login OK) e reprodução controlada com `--workers=1`. `npm run e2e:full` agora roda com `--workers=1` (ver `package.json`); os 6 overflows reais encontrados nessa execução (páginas de admin sem `flex-wrap` no cabeçalho, botão sem quebra em `EmailDashboard`, URL sem `truncate` em `RedirectsManager`) foram corrigidos e a suíte fechou 100% verde nos 3 viewports.

### R-006 — Bloco de mapa estático vazio no primeiro e-mail de um evento
- **Quando:** julho/2026
- **Sintoma:** o bloco `static_map` do template de e-mail aparecia vazio (ou mostrava o placeholder "mapa aparecerá aqui..." — visível só no preview do admin) porque `events.latitude/longitude` ainda não tinham sido preenchidos.
- **Causa:** a geocodificação só acontecia reativamente, via `EventLocationMap` (componente da página pública `/eventos/:slug`), na primeira visita ao evento. O disparo do e-mail de anúncio normalmente acontece antes de qualquer visita à página, então o evento ainda não tinha coordenadas nesse momento.
- **Correção:** `dispatchEventDraftEmail` (`src/lib/emailTemplates/dispatchEventDraft.ts`) agora chama a edge function `geocode-event` sob demanda, antes de montar os dados do e-mail, quando o evento ainda não tem lat/lng — reaproveitando a função de geocodificação já existente (idempotente, via Google Maps Geocoding API).
- **Proteção:** `src/__tests__/regression/email-map-geocode-on-dispatch.test.ts` — garante que a chamada a `geocode-event` continua presente e posicionada antes de `buildEventData`.
- **Backfill:** eventos ativos já existentes sem coordenadas precisam ser geocodificados uma vez (retroativo) — não é coberto automaticamente pela correção acima, que só age no momento do disparo.

### R-007 — Preview mostrava line-up, mas teste e rascunho E-goi não
- **Quando:** julho/2026
- **Sintoma:** o bloco de line-up aparecia corretamente no editor, mas desaparecia do e-mail de teste e do rascunho criado na E-goi. Outros blocos também podiam divergir porque cada fluxo montava o HTML separadamente.
- **Causa:** o preview carregava `lineup`, enquanto o disparo não selecionava esse campo nem o enviava ao renderizador. Preview, teste, rascunho, envio imediato e automações tinham caminhos paralelos de composição.
- **Correção:** `emailComposer.ts` passou a ser a fonte única de assunto, preheader, HTML, dados resolvidos e erros. O mesmo resultado pronto é reaproveitado pelos botões de teste, rascunho e envio, sem remontar o e-mail no clique.
- **Proteção:** `emailComposer.test.ts` cobre blocos visíveis, ocultos e globais; `email-flow-parity.test.ts` prova a igualdade do HTML entre preview e payloads; `email-composer-guard.test.ts` impede novas chamadas diretas aos renderizadores fora do compositor oficial.

### R-008 — "Enviar agora" reportava sucesso mesmo quando a E-goi mantinha rascunho
- **Quando:** julho/2026
- **Sintoma:** o botão "Enviar agora" (E-goi) mostrava "E-mail enviado!" mas a campanha continuava como rascunho na própria E-goi — nunca saía do estado draft.
- **Causa:** `create-event-email-campaign/index.ts` julgava sucesso só pelo status HTTP (`created.ok`/`sendRes.ok`), sem inspecionar o corpo da resposta da E-goi. Se `send_now=true` mas a extração do `campaignHash` da resposta de criação falhasse, o envio era pulado silenciosamente — a função retornava `status:'draft', ok:true, error:null` como se tudo tivesse dado certo. No frontend, `EmailConfig.tsx` (`dispatchBatch`/`dispatchAbTest`) decidia o toast pela flag local `sendNow` + `res.ok`, nunca por `res.status === 'sent'`.
- **Correção:** `sendNow && !campaignHash` vira erro explícito; a resposta de `actions/send` é inspecionada além do `.ok` (corpo com `error`/`errors`/`status:'error'` conta como falha); `egoi_config.segment_id` passa a ser incluído no payload; `_debug` agora expõe `egoi_send_status`/`egoi_send_body` para diagnóstico. `EmailConfig.tsx` só mostra "E-mail enviado!" quando `res.status === 'sent'` (idem por variante em `dispatchAbTest`), e mostra "Campanha criada, mas não enviada" quando fica em draft.
- **Proteção:** `src/__tests__/regression/egoi-false-success-on-draft.test.ts`.
- **Nota:** não tive acesso ao schema oficial de resposta da E-goi para `actions/send` (doc é uma SPA que WebFetch não renderiza) — a checagem de corpo é defensiva (padrão comum de erro em APIs REST), não baseada no contrato oficial. Validar com uma campanha real controlada; se ainda mostrar falso-positivo, usar `_debug.egoi_send_body` para decidir se é necessária uma segunda chamada `GET /campaigns/email/{hash}` de confirmação.

### R-009 — "Enviar teste" não chegava mais ao destino esperado
- **Quando:** julho/2026
- **Sintoma:** o botão "Enviar teste" não gerava erro, mas o e-mail nunca chegava (antes chegava).
- **Causa:** `send-test-email/index.ts` usava `to_email` do corpo da requisição, com fallback pro e-mail do admin logado. `EmailConfig.tsx` declarava um state `testEmail` sem nenhum `<Input>` vinculado — sempre vazio — então o destino real virava o e-mail de autenticação de quem clicou, não `contato@mdaccula.com`. O sucesso também era decidido só por `resp.ok` do fetch pra Resend, sem checar se ela retornou um ID de mensagem confirmando o envio.
- **Correção:** `send-test-email/index.ts` fixa o destino em `contato@mdaccula.com` (`TEST_RECIPIENT`, mesmo valor de `AUTOMATION_TEST_RECIPIENT` em `useEmailAutomation.ts`), ignorando qualquer entrada do client; sucesso passa a exigir `body.id` na resposta da Resend. `EmailConfig.tsx`/`sendTestEmail` não envia mais `to_email`, valida `data.id` e mostra destinatário + ID na tela. State morto `testEmail`/`setTestEmail` removido.
- **Proteção:** `src/__tests__/regression/send-test-email-recipient.test.ts`.
- **Nota:** remetente `onboarding@resend.dev` (sandbox da Resend) só entrega pro e-mail dono da conta Resend — configurar um domínio próprio verificado é pendência operacional, fora do escopo desta correção de código.

### R-010 — Landing/site inteiro carregando ~991KB desnecessários sempre, em toda página
- **Quando:** julho/2026
- **Sintoma:** usuário reportou a landing "demorando uma vida para carregar", tanto publicada quanto em localhost.
- **Causa:** `manualChunks` em `vite.config.ts` agrupava TODO o pacote `lucide-react` (`'icons'`) e TODO o `recharts` (`'charts'`) em dois chunks únicos. Como `ErrorBoundary`/`Toast` (montados eager na raiz do `App.tsx`) importam alguns ícones, o Rollup tratava o chunk `'icons'` INTEIRO — usado em qualquer página, inclusive admin — como dependência estática de toda rota. Resultado: ~574KB (icons) + ~417KB (charts) sempre em `<link rel="modulepreload">` no `index.html` raiz, mesmo em páginas que não usam nada disso. (Parte da lentidão relatada também era um processo de dev server duplicado no ambiente local, sem relação com o código.)
- **Correção:** removidos os agrupamentos `'icons'`/`'charts'` de `manualChunks` — o Rollup volta a fazer chunking automático por uso real (cada ícone/gráfico vira um chunk pequeno, carregado só pela página que o importa). Chunk principal cresceu ~9KB (ícones que o `ErrorBoundary`/`Toast` usam diretamente ficam inline) em troca de remover ~991KB do carregamento eager de toda página.
- **Proteção:** `src/__tests__/regression/vite-bundle-eager-preload.test.ts` — lê `vite.config.ts` e garante que `'icons'`/`'charts'`/`lucide-react`/`recharts` nunca mais apareçam dentro de `manualChunks`.

### R-011 — "Sugestões Aleatórias" gerava artigos de opinião sem nenhuma fonte real
- **Quando:** julho/2026
- **Sintoma:** artigos da categoria "Sugestões" (e do fallback genérico Cultura/Tecnologia/Produtores/Cena) eram 100% inventados — `generate-blog-suggestions` só raspava 2 fontes aleatórias pra dar "clima", e `generate-blog-post-v2` escrevia opinião sem citar nada verificável (`source_urls` sempre `null`).
- **Correção:** `generate-blog-suggestions` passou a exigir um `searchQuery` real (nome próprio rastreável na fonte scrapeada) por sugestão; `auto-article-cron` e o admin (`AIContent2.tsx`, geração individual e em lote) passaram a chamar `generate-blog-post-from-topic` (busca real via Firecrawl `/v1/search` + `source_urls` genuíno) em vez de `generate-blog-post-v2` pras categorias catch-all de Sugestões. Novo toggle `site_settings.suggestions_auto_publish` (nasce desligado) controla se o artigo publica direto ou nasce como rascunho. "Sem fonte encontrada" (404) é tratado como skip, não como falha, pro contador de falhas consecutivas do cron.
- **Proteção:** `src/__tests__/contracts/edge-sugestoes-real-source-routing.test.ts` (guard estático da nova rota em todos os arquivos envolvidos) + `src/__tests__/regression/generate-from-topic-publish-backcompat.test.ts` (garante que o chamador antigo de `generate-blog-post-from-topic`, a aba "Por Tema", continua sempre publicando).

### R-012 — Botão do evento (CTA) era inferido por substring de URL, só na página de detalhe
- **Quando:** julho/2026
- **Sintoma:** o texto do botão principal do evento ("Comprar Ingresso" vs. "Enviar Nome para Lista") era decidido em `EventDetail.tsx` checando se `ticket_link` continha o trecho `postcontrol.com.br/mdaccula/lista` — um efeito colateral do link, não uma configuração. Isso quebrava de duas formas: (1) a Home (`FeaturedEvents.tsx`) e o modal de evento (`EventModal.tsx`) nunca liam essa regra, então mostravam sempre "Comprar Ingresso(s)" mesmo para eventos de lista (ex.: Dedge aparecia errado na Home); (2) não havia como marcar um evento como "Emitir Cortesia" (ex.: Krush) nem "Comprar Ingresso com Desconto" — só existiam os dois casos hardcoded.
- **Correção:** novo campo `events.cta_type` (`buy_ticket` | `buy_ticket_discount` | `guest_list` | `courtesy`), configurável em `EventForm.tsx`. Fonte única de mapeamento texto↔tipo em `supabase/functions/_shared/eventCta.ts`, importada tanto pelo frontend (`@shared/eventCta.ts`) quanto pelas Edge Functions. `EventDetail.tsx`, `FeaturedEvents.tsx` e `EventModal.tsx` passaram a ler `cta_type` em vez de inferir. Nos e-mails, `buildEventAnnouncementData` (`_shared/emailComposer.ts`) deriva `ctaLabel` do `cta_type` (só quando não-padrão) e o bloco `cta_button` (`_shared/emailBlocks.ts`) passou a priorizar esse label entre o override explícito do template e o fallback global (`block.label > event.ctaLabel > settings.cta_label > default`). `weekend-agenda-draft` e `weekly-digest-draft` propagam o mesmo `ctaLabel` por evento nos resumos semanais.
- **Proteção:** `src/__tests__/lib/eventSelectFields.test.ts` (guarda `cta_type` na fonte única de SELECT), `src/__tests__/regression/email-flow-parity.test.ts` (guarda `cta_type` no SELECT do disparo de e-mail), `src/__tests__/lib/emailComposer.test.ts` (precedência de `ctaLabel`) e `supabase/functions/_shared/eventCta_test.ts` (Deno test, `npm run test:edge` — mapeamento dos 4 tipos + precedência do `cta_button`).

### R-013 — Monitor de Egress nunca alertava e o botão manual sempre falhava
- **Quando:** julho/2026
- **Sintoma:** a aba "Alertas" do Monitor de Egress (`/admin/egress-monitor`) ficava sempre vazia, e o botão "Executar verificação agora" sempre retornava erro.
- **Causa:** `egress-alert-cron/index.ts` nunca tinha sido agendado via pg_cron em nenhuma migration — o job só rodava se chamado manualmente com o `CRON_SHARED_SECRET` certo, que nenhum cliente tem acesso. A própria função exigia esse secret sem nenhum fallback, então o botão manual (`EgressAlertsCard.tsx`, que chamava `supabase.functions.invoke("egress-alert-cron", { headers: {} })` sem nenhum header) sempre recebia 401 — estruturalmente quebrado desde que foi escrito.
- **Correção:** `egress-alert-cron/index.ts` passa a aceitar `x-cron-secret` validado contra `internal_cron_secrets` (name='egress_alert_cron') OU `Authorization: Bearer` de um admin autenticado (`has_role`), além do `CRON_SHARED_SECRET` original — mesmo padrão de `authorizeAdminOrCron` já usado em `scan-event-sources`/`weekly-digest-draft`. `EgressAlertsCard.tsx` não sobrescreve mais o `Authorization` padrão que o supabase-js anexa automaticamente à sessão do admin. Nova migration (`20260718090000_egress_alert_cron_schedule.sql`) agenda o cron diário às 09h BRT via `internal_cron_secrets` + `net.http_post`.
- **Proteção:** `src/__tests__/regression/egress-alert-cron-auth.test.ts`.
- **Nota:** a lógica de cálculo de egress (bytes, threshold, ratio) e o envio via Resend não foram alterados — fora do escopo desta correção, que é só a causa raiz confirmada do "nunca alerta". Se as abas "Bunny CDN"/"Supabase" (não cobertas por este fix) mostrarem métricas zeradas, o próximo suspeito é secret ausente/rotacionado no ambiente live (`BUNNY_ACCOUNT_API_KEY`, `MANAGEMENT_API_PAT`), não verificável via código estático.

### R-014 — Polling de "Forçar geração agora" nunca parava se o admin saísse da tela
- **Quando:** julho/2026 (encontrado durante a limpeza de `react-hooks/exhaustive-deps`, não reportado por usuário)
- **Sintoma:** nenhum sintoma visível direto — bug de recurso, não de UI. Ao clicar "Forçar geração agora" em `/admin/blog` → Conteúdo por IA, `AutoGenerationPanel.tsx` inicia um polling de status a cada 10s (até 5min ou até detectar conclusão). Se o admin navegasse pra outra tela do admin enquanto o polling estava ativo, o `setInterval` nunca era limpo.
- **Causa:** o id do interval (`pollingInterval`) estava em `useState`. O `useEffect` de mount (`[]`) registra um cleanup que fecha sobre o valor de `pollingInterval` **no momento em que o efeito rodou** (sempre `null`, já que o polling só é setado depois, via `startPolling()`) — stale closure clássico. Resultado: no unmount, o cleanup checava `if (pollingInterval)` contra o `null` capturado no mount, nunca contra o valor real, e o `clearInterval` correspondente nunca disparava. O `setInterval` (que vive fora do React, no `window`) continuava chamando `fetchData()` a cada 10s contra um componente já desmontado, por até 5 minutos.
- **Correção:** `pollingInterval` (`useState`) trocado por `pollingIntervalRef` (`useRef`) — refs não sofrem stale closure porque o cleanup lê `.current` no momento da execução, não um valor capturado. `fetchData` também foi movida para `useCallback` e adicionada ao array de deps do efeito de mount, satisfazendo `react-hooks/exhaustive-deps` sem mudar o comportamento do fetch inicial.
- **Proteção:** ⚠️ **nenhuma ainda** — corrigido mas sem teste de regressão dedicado em `__tests__/regression/`. Um teste cobriria: montar o componente, chamar `startPolling()` (ou simular o clique), desmontar, avançar os fake timers e confirmar que `fetchData`/`clearInterval` não são chamados após o unmount.
- **Nota:** o efeito prático do bug era baixo (o timeout de 5min e a detecção de conclusão já limitavam o dano na maioria dos casos), mas o padrão (id de timer/interval em `useState` em vez de `useRef`) vale procurar em outros lugares do código que façam polling.

### R-015 — Campo opcional do template de IA bloqueava a geração como se fosse obrigatório
- **Quando:** julho/2026
- **Sintoma:** em `/admin/ai-content2` → aba Templates, marcar um campo como opcional (switch "Obrigatório" desligado) não tinha efeito nenhum — na aba Gerar, esse campo continuava bloqueando a geração se ficasse vazio, junto com os campos realmente marcados como obrigatórios.
- **Causa:** `AIContent2.tsx` normalizava `ai_prompt_templates.required_fields` (JSON `{campo: boolean}`) com `Object.keys(...)`, que pega todas as chaves configuradas e descarta o valor `true`/`false`. Todo campo cadastrado no template virava obrigatório na prática.
- **Correção:** `normalizePromptTemplateFields` (`src/lib/promptTemplateFields.ts`) separa `allFields` (todas as chaves, usadas pra renderizar o formulário em `GenerateForm.tsx`) de `requiredFields` (só as marcadas `true`, usadas pro bloqueio em `handleGenerate`). `GenerateForm.tsx` agora também indica visualmente qual campo é obrigatório (`*`) e qual é opcional.
- **Proteção:** `src/__tests__/lib/promptTemplateFields.test.ts` + `src/__tests__/regression/prompt-template-required-fields.test.ts`.

### R-016 — KPIs da analytics de links travavam em 1000 quando um filtro de data era aplicado
- **Quando:** julho/2026
- **Sintoma:** em `/admin` → Links Analytics, os cards de "Cliques em Links"/"Views em Eventos"/etc. paravam de crescer em 1000, mas só quando um filtro de período (hoje/7d/30d) estava ativo — "Todo período" sempre mostrava o número certo.
- **Causa:** `LinksAnalytics.tsx` buscava `link_click_events`/`blog_view_events`/`event_view_events`/`redirect_click_events` com um `select()` simples filtrado por data, sem paginação e sem `count: 'exact'`. O PostgREST tem um teto padrão de 1000 linhas por requisição (sem override em `supabase/config.toml`), então qualquer período com mais eventos que isso truncava silenciosamente — e a contagem por entidade era feita como `data.length` via `forEach`, propagando o teto pros cards. "Todo período" não sofria o problema por usar colunas de contador pré-agregadas (`link.clicks`, `event.views`), não as tabelas de tracking.
- **Correção:** `fetchAllPaginated` (`src/lib/supabasePagination.ts`) pagina em blocos de 1000 via `.range()` até esgotar o resultado real, aplicado aos 4 blocos de busca por período.
- **Proteção:** `src/__tests__/lib/supabasePagination.test.ts` + `src/__tests__/regression/links-analytics-1000-cap.test.ts`.

### R-017 — Sugestões de Eventos/Festivais/Lançamentos podiam inventar lineup/local/horário
- **Quando:** julho/2026 (gap deixado por R-011, encontrado numa auditoria de acompanhamento)
- **Sintoma:** ao gerar manualmente (aba Sugestões) uma sugestão dessas 3 categorias, o artigo saía pelo template de evento (`generate-blog-post-v2`) sem nenhuma busca de fonte real — diferente do fluxo automático (cron), que já ancorava toda categoria em busca real desde a correção de R-011.
- **Causa:** `TEMPLATE_ROUTED_CATEGORIES` em `AIContent2.tsx` incluía `eventos`/`festivais`/`lançamentos`/`lancamentos`, mandando essas categorias pro template dedicado em vez do catch-all ancorado. A sugestão gerada em `generate-blog-suggestions` não carrega nenhum dado estruturado real (lineup/data/venue) pra essas categorias — só título/resumo/categoria, todos gerados por IA — então o template de evento escrevia essas seções sem fonte nenhuma.
- **Correção:** removidas `eventos`/`festivais`/`lançamentos`/`lancamentos` de `TEMPLATE_ROUTED_CATEGORIES`, caindo automaticamente no catch-all que já chama `generate-blog-post-from-topic` (busca real via Firecrawl, `source_urls` preenchido). `entrevistas`/`labels` ficam de fora por ora — podem ter sinal real próprio via `event_sources`/scan, fora do escopo desta investigação.
- **Proteção:** teste estendido em `src/__tests__/contracts/edge-sugestoes-real-source-routing.test.ts` (guarda que essas 4 strings não voltam pra `TEMPLATE_ROUTED_CATEGORIES`).

### R-018 — Aba "Gerar" manual publicava artigo de evento totalmente inventado quando o template não tinha dado real por trás
- **Quando:** julho/2026 (gap distinto de R-017 — esse é a aba **Gerar**, não Sugestões)
- **Sintoma:** ao usar o template "Raspagem de Eventos" na aba Gerar digitando só `eventName` (ex.: "a liga", "solomun"), o artigo saía com lineup/local/horário completamente inventados, e **foi publicado direto** (`published: true`) sem nenhuma fonte real (`source_urls: null`). Os dois posts foram despublicados manualmente durante a investigação.
- **Causa:** `ai_prompt_templates` tem 2 templates de categoria "Eventos": "Evento Padrão" (usado quando um evento real do site é criado) e "Raspagem de Eventos" (comentário em `scan-event-sources/index.ts`: dedicado ao pipeline automático Event Watcher, que já extrai dados reais antes de chamar `generate-blog-post-v2`). Nada impedia escolher "Raspagem de Eventos" manualmente na aba Gerar sem nenhum dado real. Em `generate-blog-post-v2/index.ts`, `isEventMode` liga sempre que o template é da categoria Eventos/Festivais, mesmo sem `hasEventSignals` (sem `eventDate`/`venue`/`lineup`/etc.) — o bloco anti-hedging força a IA a escrever com confiança mesmo sem dado nenhum. O "scraping" que a function já fazia (`shouldScrapeForContext`) é só contexto de tom genérico de 2 sites fixos, sem relação com o evento específico — nunca uma busca real pelo tema.
- **Gap relacionado:** o frontend (`AIContent2.tsx`) nunca lia o corpo JSON de erro de uma Edge Function — só `error.message` genérico do SDK do Supabase (`FunctionsHttpError.context` é o `Response` bruto, a mensagem real só existe no corpo). Mesmo quando o backend já respondia com uma mensagem clara, o admin só via um toast genérico.
- **Correção:** novo guardrail em `generate-blog-post-v2/index.ts` — quando `isEventMode && !hasEventSignals` (`shouldRequireSourceVerification`, `supabase/functions/_shared/eventSourceGuardrail.ts`), exige uma busca real via Firecrawl (`searchWithFirecrawl`, extraída pra `supabase/functions/_shared/firecrawlSearch.ts` e reaproveitada por `generate-blog-post-from-topic`) antes de gerar. Sem fonte encontrada → 404 com mensagem clara, **nenhum artigo é criado**. Com fonte → injeta como contexto real no prompt e grava em `ai_generated_posts.source_urls` (antes sempre `null` nesse caminho). Fluxos legítimos (evento real do site, multi-evento, scan-event-sources) sempre chegam com `hasEventSignals=true` e não são afetados. Novo `src/lib/edgeFunctionErrorMessage.ts` (`getEdgeFunctionErrorMessage`) extrai a mensagem real do `error.context` e é usado em todos os handlers de geração de `AIContent2.tsx` (`handleGenerate`, `handleGenerateFromTopic`, `handleGenerateFromSuggestion`, `handleGenerateSelected`), não só nesse fluxo.
- **Proteção:** `supabase/functions/_shared/eventSourceGuardrail_test.ts` + `supabase/functions/_shared/firecrawlSearch_test.ts` (Deno, `npm run test:edge`) + `src/__tests__/lib/edgeFunctionErrorMessage.test.ts` + `src/__tests__/regression/generate-blog-post-v2-source-guardrail.test.ts` + `src/__tests__/regression/edge-function-error-message-surfaced.test.ts`.

### R-019 — og:title/og:description/twitter:*/meta description/canonical nunca mudavam por rota
- **Quando:** julho/2026 (encontrado durante o teste manual do prerender de R-018/Fase 4 SEO)
- **Sintoma:** `document.title` mudava corretamente por rota (ex.: evento mostrava "🎩 Helvétia Open Bar | MDAccula"), mas `og:title`/`og:description`/`twitter:title`/`twitter:description`/`meta name="description"`/`link rel="canonical"` continuavam sempre com o texto genérico do site inteiro, mesmo depois da página hidratar por completo. Confirmado em teste real contra o site publicado: existiam **duas** tags `og:title` no DOM final (a genérica, sem atributo `data-rh`, e a correta da rota, com `data-rh="true"`) — parsers de link preview (WhatsApp, Facebook, etc.) e Googlebot típicamente respeitam a primeira ocorrência.
- **Causa:** `index.html` tem essas tags hardcoded como fallback estático (pro caso de um crawler sem JS chegar antes da hidratação). `react-helmet-async` só reconhece tags que já tenham o atributo `data-rh` pra decidir o que substituir (`node_modules/react-helmet-async/lib/index.esm.js`, função `updateTags()`, filtra por `${type}[data-rh]`) — sem esse atributo nas tags estáticas, o Helmet nunca as via e só **acrescentava** a versão real da rota ao lado da genérica, nunca removendo a antiga. `<title>` não sofria disso porque Helmet gerencia esse elemento via `document.title` diretamente, não pelo mesmo mecanismo de diff de `<meta>`/`<link>`.
- **Correção:** adicionado `data-rh="true"` em todas as tags de `index.html` que o `SEOHead.tsx` também gerencia (description, keywords, og:type, og:site_name, twitter:card, canonical, og:image, twitter:image, og:title, twitter:title, og:description, twitter:description) — agora o Helmet as reconhece como próprias e as substitui de verdade no primeiro render, em vez de só empilhar tags duplicadas.
- **Proteção:** `src/__tests__/regression/seohead-static-tag-duplication.test.tsx` — renderiza `<SEOHead>` sobre um `document.head` semeado com as tags estáticas (incluindo `data-rh`) e confirma que sobra exatamente uma tag de cada tipo, com o conteúdo da rota. Verificado manualmente (red/green) que o teste falha sem o `data-rh` nas tags semeadas, provando que ele pega a regressão de verdade.

### R-020 — E-mail diário de métricas chegava com fundo branco e fonte branca (ilegível)
- **Quando:** julho/2026 (reportado pelo usuário no primeiro e-mail real recebido, um dia após o rollout de R-019's feature vizinha)
- **Sintoma:** o e-mail "📊 Métricas Diárias — MDAccula" (`daily-metrics-email`) chegava com layout quebrado — fundo branco em partes do corpo, com texto na cor clara pensada pro fundo escuro (`#eee`/`#fff`/`#999`) sobre esse fundo branco, tornando várias partes ilegíveis.
- **Causa:** `buildEmailHtml` (`supabase/functions/daily-metrics-email/metrics.ts`) devolvia um `<div>` solto com `background:#0a0a0a` inline, sem nenhum wrapper `<!doctype html><html><head><body>`. Sem esse wrapper: (1) clientes como Outlook desktop não respeitam a propriedade CSS `background` em `<div>` (só em `bgcolor`/`background-color` de `<table>`/`<td>`), então caem pro fundo branco padrão do cliente; (2) clientes com auto-dark-mode (Apple Mail, Gmail) tentam adivinhar o esquema de cor de e-mails sem `<meta name="color-scheme">` declarado e podem inverter só parte das cores, gerando combinações ilegíveis. As outras funções de e-mail do projeto (`weekly-digest-draft`, `blog-digest-draft` etc.) já usavam o padrão correto — só `daily-metrics-email` (adicionada nesta mesma sessão) tinha esse gap.
- **Correção:** `buildEmailHtml` reescrito como HTML completo (`<!doctype html><html><head>` com `<meta name="color-scheme" content="dark">` + `<meta name="supported-color-schemes" content="dark">`, `<body style="background-color:#0a0a0a">`) usando estrutura table-based (`<table role="presentation" bgcolor="#0a0a0a" style="background-color:#0a0a0a">`) com `bgcolor` e `background-color` redundantes nos dois níveis de tabela — mesmo padrão já comprovado em `weekly-digest-draft/index.ts`. Aproveitado pra também escapar (`escapeHtml`) todo texto vindo de dados (rótulos, nomes de destaques), o que ainda não existia.
- **Melhoria pedida junto:** o e-mail agora inclui uma seção "🏆 Destaques de ontem" com o artigo mais acessado, o link (linktree) mais clicado e o evento mais visto do dia anterior — `findMostFrequent` conta ocorrências de `post_id`/`link_id`/`event_id` na janela BRT de ontem (mesmo volume baixo de tráfego já assumido pelo resto da function, sem precisar de uma function SQL de `GROUP BY`) e `getTopEntity` (`index.ts`) busca o título/slug/url correspondente.
- **Proteção:** `supabase/functions/daily-metrics-email/metrics_test.ts` — 9 testes novos (`findMostFrequent`, wrapper `<html>`/`<body>`/`color-scheme` presentes, seção de destaques presente/ausente conforme dado, escape de HTML no nome do destaque). Verificado manualmente (red/green): revertido o wrapper completo pra confirmar que o teste de layout falha sem a correção, depois restaurado.
- **Follow-up (mesma sessão):** logo da MDAccula adicionado no topo do e-mail (`<img>` apontando pra `https://mdaccula.com/logo-mdaccula.jpeg`, mesmo asset estático já usado como `og:image` em `index.html`). Adicionados dois cards novos abaixo de "Destaques de ontem", no mesmo esquema visual (card escuro, label | valor | variação colorida): **"Últimos 7 dias"** (soma dos 7 dias corridos incluindo ontem, comparada com os 7 dias corridos anteriores a esses — janela diferente da "média 7d" da tabela principal, que exclui ontem) e **"Mês atual"** (do dia 1 do mês até ontem, comparado com o mesmo número de dias corridos do mês anterior, também a partir do dia 1 — `getBRTMonthToDateWindows` trunca corretamente quando o mês anterior tem menos dias, ex.: 31/03 vs. até 28/02, e cruza o ano corretamente, ex.: início de janeiro vs. dezembro do ano anterior). `formatBRTDateRange` formata os rótulos "dd/mm – dd/mm" a partir da janela `[start, end)` exclusiva.
- **Proteção (follow-up):** mais 9 testes em `metrics_test.ts` (`formatBRTDate`, `formatBRTDateRange`, `getBRTMonthToDateWindows` — caso normal, truncamento de mês curto, virada de ano —, presença do logo, renderização dos cards de período com dado e ausência deles quando omitidos).
- **Follow-up 2 (mesma sessão):** ajuste só de CSS inline pedido pelo usuário — espaço entre cards de 4px para ~20px, padding interno maior, título principal 20px→26px, títulos de card 12px→14px. Sem mudança de lógica, os 28 testes existentes continuam cobrindo o conteúdo (não o CSS em si).

### R-021 — Imagens de evento/post/logo em `.webp` não apareciam no Outlook nos e-mails de digest
- **Quando:** julho/2026 (usuário testou "Enviar teste agora" do Blog News e reportou que fotos de eventos não aparecem no Outlook, enquanto fotos de artigo gerado por IA aparecem normalmente)
- **Sintoma:** nos e-mails de `weekly-digest-draft`, `weekend-agenda-draft` e `blog-digest-draft`, imagens de card de evento, de post do blog e o logo do cabeçalho ficavam com "X" no lugar da imagem no Outlook desktop — mas o flyer em destaque (`hero_image`) e imagens soltas (`image_with_link`) sempre funcionavam.
- **Causa:** já existia `proxyForEmail()` (`supabase/functions/_shared/emailBlocks.ts`) — detecta `.webp` (formato que o Outlook 2016+/motor Word não renderiza) e reescreve a URL via `wsrv.nl` pra entregar JPG. Mas essa função só era chamada em 2 dos 8 pontos que montam `<img src>` dentro de `renderBlock()`: `hero_image` e `image_with_link`. Os outros 6 (`weekend_grid` × 2 layouts, `dedge_block`, `weekly_hero`, `blog_posts_list` × 2 layouts, `article_summary`, e o logo do `header`) usavam a URL crua do banco — se fosse `.webp` (caso comum de imagem de evento, que passa pelo pipeline de otimização do site), quebrava no Outlook. Fotos de artigo gerado por IA normalmente não são `.webp` (PNG/JPG do gerador), por isso pareciam "sempre funcionar" mesmo sem a proteção — não porque o caminho delas estivesse certo, mas porque o formato não acionava o problema. Os 3 renderizadores "legado" (fallback usado só quando não há template ativo por blocos: `renderDigestHtml`/`renderLegacyBlogHtml`/`renderFallbackHtml`, um em cada function) nunca tiveram essa proteção.
- **Correção:** `proxyForEmail()` aplicada nos 7 pontos que faltavam em `emailBlocks.ts`, e importada + aplicada no logo e na imagem de evento/post dos 3 renderizadores legado. Como "Gerar rascunho" e "Enviar teste" usam exatamente a mesma função de render (`composeEmail`/`renderBlockedTemplate`), a correção cobre os dois caminhos automaticamente — não existe um terceiro caminho de "enviar pra todos" no código do site: o envio final é sempre manual, feito pelo usuário dentro do painel da própria E-goi, usando o HTML do rascunho já corrigido.
- **Proteção:** `supabase/functions/_shared/emailBlocks_test.ts` — 9 testes novos cobrindo cada um dos 7 blocos + o logo do header com uma imagem `.webp` (confirma que a URL final contém `wsrv.nl` e não a URL `.webp` crua) e 1 teste confirmando que `.jpg` passa intacto (sem proxy desnecessário). Verificado manualmente (red/green): revertida a chamada de `proxyForEmail` em `weekend_grid` e confirmado que os 2 testes desse bloco falham, depois restaurado.

### R-022 — "Blog news" enviava artigos de eventos que já tinham acontecido
- **Quando:** julho/2026 (usuário notou no e-mail de domingo 19/07 um artigo sobre o evento Krush, que era dia 17/07 — já passado e já desativado no site)
- **Sintoma:** `blog-digest-draft` (o e-mail "Blog news") lista posts publicados nos últimos N dias (`days_back`, padrão 7) sem nenhuma verificação sobre eventos vinculados a esses posts — um artigo gerado pra divulgar um evento continuava aparecendo no e-mail mesmo depois do evento já ter acontecido, o que não faz sentido pro leitor.
- **Causa:** `blog_posts` não guarda referência pro evento (é `events.blog_post_id` que aponta pro post, nunca o inverso) — a query original (`admin.from('blog_posts').select(...).eq('published', true).gte('published_at', rangeStart)...`) nunca fazia esse cruzamento, então não tinha como saber se o post estava "vencido".
- **Correção:** depois de buscar os posts candidatos, uma segunda query busca em `events` todos os registros com `blog_post_id` entre os posts candidatos (`date`, `end_date`). `filterOutPastEventPosts` (`supabase/functions/blog-digest-draft/pastEventFilter.ts`, função pura) remove os posts cujo(s) evento(s) vinculado(s) já passaram — comparando `end_date` (ou `date`, se não for evento de vários dias) contra a data de hoje em BRT, por comparação de string `YYYY-MM-DD` (evita os problemas de fuso de `new Date("YYYY-MM-DD")`, mesmo cuidado de `parseLocalDate`). Posts sem evento vinculado (a maioria) nunca são afetados; posts com mais de um evento vinculado só são removidos se TODOS já passaram. Escopo intencionalmente restrito ao Blog News (não ao digest semanal), por decisão do usuário.
- **Proteção:** `supabase/functions/blog-digest-draft/pastEventFilter_test.ts` — 10 testes cobrindo: sem evento vinculado, evento passado, evento futuro, evento hoje (não é "passado"), evento de vários dias em andamento vs. encerrado, múltiplos eventos vinculados (mantém se pelo menos um é futuro), lista mista, e link com `blog_post_id` nulo.

### R-023 — Envio manual de e-mail ficava travado até por avisos não-bloqueantes
- **Quando:** julho/2026 (usuário reportou ao tentar enviar o template "Virada de Lote" pro evento "Sun")
- **Sintoma:** `dispatchBatch`/`scheduleBatch` (`EmailConfig.tsx`) já usavam `partitionIssues` (warnings vs blockers) e só interrompiam o envio de verdade por `blockers`, mas os botões "Enviar teste" / "Criar rascunho na E-goi" / `SendNowButton` / `ScheduleSendPanel` continuavam com `disabled` calculado sobre `manualComposition.issues.length` bruto (sem partição) — o clique nunca chegava a acontecer quando havia só warnings (ex.: `DESCRIPTION_MISSING`), mesmo o handler por baixo já permitindo o envio nesse caso.
- **Causa:** o classificador de warnings/blockers (`issueClassifier.ts`) tinha sido aplicado aos handlers, mas não ao estado `disabled` dos controles de UI — dois pontos de checagem que deveriam usar a mesma fonte de verdade e não usavam.
- **Correção:** os 4 controles agora desabilitam só com `manualIssuePartition.blockers.length > 0` (mesma partição usada pelos handlers). O card de aviso mostra "Pendências (não impedem o envio)" em amber quando só há warnings, reservando o vermelho "Corrija antes de enviar" pra blockers de verdade. A prévia do envio manual (`manualComposition`) também passou a filtrar blocos `weekend_grid`/`weekly_hero`/`blog_posts_list`/`dedge_block` em templates de evento único, igual `dispatchEventDraft.ts` já fazia no disparo real — evita a prévia mostrar um aviso ("não há eventos para montar a agenda") que o envio de fato não teria.
- **Proteção:** `src/__tests__/regression/email-manual-send-warning-not-blocking.test.ts`.

### R-024 — Nome customizado do festival era descartado ao mesclar eventos
- **Quando:** julho/2026 (usuário reportou ao mesclar "Parador apres. Mochakk e+++" + 3 dias em "Parador Reveillon - Dias Avulsos")
- **Sintoma:** No `MergeEventsDialog`, o campo "Nome do festival (evento final)" permitia digitar um nome customizado, mas o evento mesclado salvo no banco (e exibido em `/eventos` e `/eventos/:slug`) mantinha o título original do evento "principal" escolhido, ignorando o que o admin digitou. Confirmado via `application_logs`: o log de auditoria do merge real gravou `new_title` idêntico ao `primary_title`, provando que o campo estava vazio no momento do envio.
- **Causa:** o `useEffect` que sincronizava `mergedTitle` com o título do principal usava um `useRef` que só comparava o `id` do principal — disparando (e sobrescrevendo o campo) em qualquer troca de evento principal, inclusive a primeira seleção de principal depois que o admin já tinha digitado um nome. Como o dialog fica montado o tempo todo em `EventsManager` (não é recriado a cada abertura), o `primaryId` também podia iniciar `undefined` (guia `events=[]` antes de marcar checkboxes), tornando o campo nunca auto-preenchido na primeira abertura.
- **Correção:** flag `titleTouched` (setada no `onChange` do input) impede que o efeito de sincronização sobrescreva o campo depois que o admin começa a editá-lo manualmente; um segundo efeito reseta `primaryId`/`titleTouched` sempre que o modal abre para um novo grupo de eventos.
- **Proteção:** `src/__tests__/regression/merge-events-dialog-title-preserved.test.tsx`.

### R-025 — "Geração por Tema" citava YouTube/Spotify/Apple Music/SoundCloud como fonte
- **Quando:** julho/2026 (usuário reportou nos artigos "O melhor do dub techno..." e "Alok: do Brasil ao mundo...")
- **Sintoma:** O modal "Fontes e origem do artigo" (`BlogManager.tsx`) mostrava como "Fontes usadas"/"Contexto adicional" links de YouTube, Spotify, Apple Music e SoundCloud — nada relacionado ao catálogo de fontes cadastradas em Admin → Fontes (`event_sources`).
- **Causa:** `generate-blog-post-from-topic/index.ts` busca contexto real via `searchWithFirecrawl()` (`supabase/functions/_shared/firecrawlSearch.ts`), que bate na API de busca livre do Firecrawl (`/v1/search`) sem nenhum filtro de domínio. Pra termos de música/artista, o resultado mais "relevante" de uma busca na web costuma ser página de player/playlist/perfil, não conteúdo jornalístico — comportamento intencional desde R-011 (busca real em vez de artigo inventado), mas sem filtro de qualidade de fonte.
- **Correção:** `firecrawlSearch.ts` ganhou uma blocklist de hostnames (`BLOCKED_HOSTNAMES`) cobrindo as principais plataformas de streaming/social (youtube.com, spotify.com, music.apple.com, soundcloud.com, instagram.com, tiktok.com, facebook.com, x.com/twitter.com, com subdomínios) — filtradas antes de entrar no contexto da IA ou no `source_urls` salvo. Como `searchWithFirecrawl()` é compartilhada, o guardrail de `generate-blog-post-v2` (R-002) também se beneficia automaticamente.
- **Proteção:** `supabase/functions/_shared/firecrawlSearch_test.ts` (Deno test, `npm run test:edge`) — garante que um resultado de busca com streaming/social misturado a uma fonte real só retorna a fonte real.

### R-026 — Nenhum envio real de campanha E-goi completava (422 `segments.isEmpty`)
- **Quando:** julho/2026 (usuário reportou ao clicar "Enviar agora" numa campanha real)
- **Sintoma:** Toda tentativa de envio real de campanha (botão "Enviar agora" e o poller de agendamento) falhava com `422 {"errors":{"segments":{"isEmpty":"Value is required and can't be empty"}}}` — a campanha era criada como rascunho na E-goi, mas o disparo de fato nunca completava, mesmo no caso simples de "enviar pra lista inteira".
- **Causa:** consultei a documentação oficial da E-goi (`developers.e-goi.com/api/v3`, Campaigns → Email → "Send email message") e confirmei que `POST /campaigns/email/{hash}/actions/send` exige um campo `segments` (objeto, ex.: `{"type":"none"}` pra lista inteira) além de `list_id`. Nenhum dos 3 pontos que chamavam esse endpoint (`create-event-email-campaign/index.ts`, `send-scheduled-email-campaigns/index.ts`, e o próprio helper `_shared/egoiClient.ts`) enviava esse campo — R-004 (julho/2026) já tinha corrigido a falta de `list_id` nesse mesmo endpoint, mas a falta de `segments` nunca tinha sido detectada porque, sem acesso à doc oficial na época, R-004/R-008 corrigiram por tentativa e erro.
- **Correção:** a montagem do payload de `actions/send` foi consolidada em `sendEgoiCampaign()` (`_shared/egoiClient.ts`), que agora monta `{ list_id, segments }` — `segments: { type: "none" }` quando não há `segment_id` configurado (confirmado contra a doc oficial), ou `{ type: "segment", segment_id }` quando há (best-effort — a doc não expandiu essa variante na página consultada). `create-event-email-campaign` e `send-scheduled-email-campaigns` passaram a chamar essa função em vez de duplicar a montagem do payload inline (a duplicação em 3 lugares foi o que permitiu o mesmo tipo de bug reaparecer depois de R-004).
- **Proteção:** `src/__tests__/regression/egoi-send-missing-list-id.test.ts` (atualizado — agora cobre `list_id` E `segments`, e trava a duplicação verificando que os 2 call-sites usam `sendEgoiCampaign`), `src/__tests__/regression/egoi-false-success-on-draft.test.ts` e `src/__tests__/regression/scheduled-send-false-success-on-draft.test.ts` (atualizados pra apontar pro novo local centralizado).

### R-027 — Warning `fetchPriority` no `<img>` do avatar de /links quebrava o smoke E2E
- **Quando:** julho/2026
- **Sintoma:** `e2e/smoke.spec.ts` ("/links renders at least one link card") falhava — `assertNoErrors` (`e2e/helpers/pageHealth.ts`) trata qualquer `console.error` como falha, e o `<img>` do avatar em `Links.tsx` passava a prop `fetchPriority="high"` (camelCase) direto pro elemento DOM, o que o React 18 não reconhece (suporte só chegou no React 19), gerando "React does not recognize the `fetchPriority` prop on a DOM element...".
- **Causa:** `fetchPriority` é o nome da prop em JSX/TypeScript (é como o `@types/react` 18.3.x expõe o atributo), mas o React 18 (`react-dom` 18.3.1) ainda não faz a tradução dessa prop pro atributo HTML nativo `fetchpriority` — só passa por diante e loga o warning de prop desconhecida.
- **Correção:** trocado para o atributo HTML nativo em minúsculo `fetchpriority="high"` em `Links.tsx` — TypeScript aceita porque `ImgHTMLAttributes` não restringe atributos desconhecidos em minúsculo, e o React não emite warning porque o nome já bate com o `lowerCasedName` esperado.
- **Proteção:** `src/__tests__/regression/links-avatar-fetchpriority-lowercase.test.ts` (guarda estática — falha se `fetchPriority=` camelCase voltar a aparecer em `Links.tsx`).

### R-028 — Favicon "revertia sozinho" pro ícone padrão do Lovable
- **Quando:** julho/2026
- **Sintoma:** o favicon do site (logo MDAccula) periodicamente aparecia como o ícone padrão do Lovable (coração gradiente) para usuários, de forma aparentemente aleatória e recorrente — já tinha sido corrigido uma vez (14/07/2026, regenerando `public/favicon.ico`) mas voltava a acontecer.
- **Causa:** `public/service-worker.js` tratava `.ico` como imagem (`IMAGE_PATTERNS`) e servia via `cacheFirst` — a única estratégia do arquivo que nunca revalida contra a rede. Um navegador que em algum momento cacheou uma versão errada do favicon (ex.: durante a janela em que o arquivo em produção estava sobrescrito pelo ícone padrão) ficava preso nela para sempre, mesmo com o servidor já servindo o arquivo correto. O efeito "fica alterando" vinha de cada bump de `CACHE_VERSION` do Service Worker forçar uma nova busca na rede — que então mostrava o que estivesse correto (ou não) naquele instante.
- **Correção:** `.ico` removido de `IMAGE_PATTERNS` — favicon agora cai no `networkFirst` padrão (sempre tenta a rede primeiro). `CACHE_VERSION` incrementado (`v13` → `v14`) para forçar todo navegador já afetado a descartar o cache antigo na próxima visita.
- **Proteção:** `src/__tests__/regression/service-worker-favicon-cache.test.ts` (guarda estática — falha se `.ico` voltar a entrar em `IMAGE_PATTERNS`, e confirma que `CACHE_VERSION` não regrediu abaixo de `v14`).

### R-029 — "Enviar agora" (aba Automações) ficava travado após reload
- **Quando:** julho/2026
- **Sintoma:** depois de gerar um rascunho de Digest semanal/Agenda FDS/Blog news e recarregar a página (ou só navegar e voltar), o botão "Enviar agora" voltava a aparecer desabilitado, exigindo gerar um novo rascunho antes de poder enviar — mesmo já existindo uma campanha válida criada na E-goi minutos antes.
- **Causa:** `digestLastResult`/`weekendLastResult`/`blogLastResult` (`useEmailAutomation.ts`) eram só estado React em memória, nunca persistido — `loadAll()` (`EmailConfig.tsx`) nunca os restaurava, então todo mount zerava o valor e o botão (`disabled={!digestLastResult?.egoi_campaign_id}`) ficava preso em "sem rascunho".
- **Correção:** o último rascunho de cada job passou a ser persistido em `site_settings` (`${job}_last_result`, JSON) logo após ser gerado, e restaurado em `loadAll()`. Para não abrir uma janela de reenvio duplicado (mesma campanha enviada duas vezes pra lista inteira), `sendAutomationNow` agora recebe o `job` e limpa tanto o estado local quanto o valor persistido assim que o envio é confirmado com sucesso.
- **Proteção:** `src/__tests__/regression/automation-send-now-stuck-after-reload.test.ts` (guarda estática — falha se a persistência ou a limpeza pós-envio regredirem).

### R-030 — Artigos de "Sugestões"/"Gerar por Tema" citavam Wikipédia/IMDb como fonte para nomes ambíguos
- **Quando:** julho/2026 (usuário reportou nos artigos sobre "DJ Chus" e "Anna de Lucc")
- **Sintoma:** artigos gerados citavam como "fonte real" páginas de Wikipédia ou de bases de filme/TV (ex.: IMDb) sem nenhuma relação com jornalismo de música eletrônica — para nomes ambíguos de DJ/produtor que colidem com verbetes de enciclopédia ou fichas de filme/ator homônimas. A tela "Fontes" (`FontesManager.tsx`) também descrevia a lista `event_sources` como "usada pela IA como referência para gerar posts do blog" de forma enganosa: essa lista só alimenta o Event Watcher (`scan-event-sources`), não o pipeline que gerou os casos citados.
- **Causa:** o blocklist de domínios adicionado em R-025 cobria só streaming/redes sociais, não enciclopédias nem bases de filme/TV — então qualquer página da Wikipédia/IMDb/etc. que rankeasse alto pra um termo ambíguo passava direto pro prompt da IA como "FONTES ENCONTRADAS" (`generate-blog-post-from-topic/index.ts`), sem nenhuma checagem de relevância editorial.
- **Correção:** `BLOCKED_HOSTNAMES` em `_shared/firecrawlSearch.ts` ganhou `wikipedia.org`, `wikimedia.org`, `wikiwand.com`, `imdb.com`, `themoviedb.org`, `rottentomatoes.com`, `letterboxd.com`, `fandom.com` (R-031, mesmo mecanismo de R-025 — beneficia `generate-blog-post-from-topic` e o guardrail de `generate-blog-post-v2` automaticamente). Subtítulo de `FontesManager.tsx` corrigido para deixar explícito que a lista só alimenta o Event Watcher. Diálogos que já exibiam `source_urls` (`BlogManager.tsx`, `PostsHistory.tsx`) passaram a rotular claramente esses links como "resultado de busca na web", não como fonte cadastrada. Novo botão "Ver fontes" por sugestão (`SuggestionsList.tsx` + edge function `preview-topic-sources`) permite ao admin conferir, antes de gerar o artigo, quais páginas a busca encontraria para aquele termo.
- **Proteção:** `supabase/functions/_shared/firecrawlSearch_test.ts` (Deno test — novo caso R-031), `src/__tests__/regression/firecrawl-search-encyclopedia-hallucination.test.ts` (guarda estática — falha se algum desses domínios sair do blocklist).

### R-031 — Duplicar template "Virada de lote" perdia a seleção múltipla de eventos
- **Quando:** agosto/2026 (usuário reportou ao copiar o template pra criar uma variante de agenda de fim de semana com múltiplas promoções)
- **Sintoma:** duplicar qualquer template no editor de e-mail (`EmailTemplateEditor.tsx`) sempre criava a cópia com `type: 'custom'`, mesmo quando o original era `ticket_batch_multi` ("Virada de lote — múltiplos eventos"). Como a seleção múltipla de eventos na aba Envio Manual depende estritamente de `template.type === 'ticket_batch_multi'` (`useManualBatch.ts`), a cópia virava um template de evento único sem nenhum aviso — o checkbox de múltiplos eventos simplesmente sumia.
- **Causa:** `duplicateTemplate()` hardcodava `type: 'custom'` no insert em vez de preservar o tipo do template original.
- **Correção:** `duplicateTemplate()` (`EmailTemplateEditor.tsx`) agora usa `type: activeTpl.type` — a cópia mantém o tipo original e, por consequência, toda capacidade que depende dele (multi-seleção de eventos inclusive).
- **Proteção:** `src/__tests__/regression/email-template-duplicate-preserves-type.test.ts` (guarda estática — falha se `duplicateTemplate` voltar a hardcodar `type: 'custom'`).

### R-032 — Segmento escolhido no Envio Manual resetava silenciosamente pro padrão global
- **Quando:** agosto/2026 (usuário reportou que o envio segmentado "não respeitava o segmento" e ia pra todos os contatos)
- **Sintoma:** na aba Envio Manual, escolher um segmento específico e depois trocar o Evento ou o Template (fluxo natural de ajuste antes de enviar) resetava `batchSegmentId` de volta pra "Padrão da configuração global" — sem nenhum aviso visual além do próprio Select recarregar. O admin confirmava o envio achando que o segmento escolhido seria usado, mas na prática ia pro segmento/lista padrão da configuração global.
- **Causa:** `ManualSendTab.tsx` chamava `setBatchSegmentId(undefined)` tanto no `onValueChange` do Select de Evento quanto no do Select de Template — resets desnecessários, já que o segmento é uma escolha de audiência independente do evento/template selecionado. Além disso, o painel "Revisão final" e o modal de confirmação de envio não mostravam qual segmento seria usado, então o reset passava despercebido.
- **Correção:** removidos os dois `setBatchSegmentId(undefined)` de `ManualSendTab.tsx` — o segmento escolhido agora persiste ao trocar evento/template. Adicionado `resolvedSegmentLabel` (nome do segmento resolvido, com contagem de contatos quando disponível) exibido na "Revisão final" e passado como prop `segmentLabel` pro `SendNowButton`, que agora mostra explicitamente pra quem o envio vai antes de pedir a confirmação final.
- **Proteção:** `src/__tests__/regression/email-manual-send-segment-not-reset.test.ts` (guarda estática — falha se os Selects de Evento/Template voltarem a resetar `batchSegmentId`, e confirma que `segmentLabel` é passado ao `SendNowButton`).

### R-033 — Eventos enviados via Digest semanal/Agenda FDS nunca apareciam como "enviados" no histórico
- **Quando:** agosto/2026 (usuário reportou que eventos como Dedge e Indústria não ficavam marcados como enviados, mesmo depois do Digest semanal/Agenda FDS sair)
- **Sintoma:** a aba "Histórico e controle" (`EmailEventsTab.tsx`) só lê a tabela `event_email_campaigns` (uma linha = um evento). O envio individual e o "Virada de lote — múltiplos eventos" já gravavam essas linhas corretamente, mas `weekly-digest-draft/index.ts` e `weekend-agenda-draft/index.ts` — que despacham UMA campanha cobrindo vários eventos de uma vez — nunca escreviam nada em `event_email_campaigns`. Resultado: todo evento que só recebeu e-mail via digest/agenda (nunca individualmente) ficava permanentemente marcado como "pendente" no histórico, mesmo já tendo sido enviado.
- **Causa:** as duas edge functions terminavam a resposta (sucesso, falha de criação ou falha de envio) sem nenhuma escrita em `event_email_campaigns` — gap arquitetural, não um bug de lógica: o padrão de "N linhas compartilhando o mesmo `egoi_campaign_id`" já existia em `create-multi-event-email-campaign/index.ts`, mas nunca foi replicado pros dois disparos automáticos.
- **Correção:** novo helper `supabase/functions/_shared/digestCampaignHistory.ts` (`writeDigestCampaignHistory`) replica esse padrão. Chamado nos 3 desfechos possíveis de cada função (falha ao criar a campanha, falha ao enviar, sucesso), usando todos os `event_id` da faixa de datas coletada (`evs`, antes de qualquer agrupamento — cobre inclusive as noites individuais da Dedge) e `campaign_type: 'weekly_digest'`/`'weekend_agenda'` pra distinguir da origem no histórico. Não faz claim de `events.email_campaign_dispatched_at` (propositalmente — ver comentário no arquivo): digests são recorrentes e cobrem faixas que se sobrepõem, então travar esse campo bloquearia envios individuais futuros do mesmo evento.
- **Proteção:** `supabase/functions/_shared/digestCampaignHistory_test.ts` (Deno test — grava N linhas com o mesmo `egoi_campaign_id`, engole erro de insert sem lançar), `src/__tests__/regression/digest-agenda-write-campaign-history.test.ts` (guarda estática — falha se as chamadas a `writeDigestCampaignHistory` sumirem de qualquer um dos 3 desfechos em qualquer uma das duas functions).

### R-034 — Editor de e-mail mostrava "Esquerda" em blocos que já saem centralizados no envio real
- **Quando:** agosto/2026 (usuário reportou que vários blocos carregavam com o seletor de alinhamento em "Esquerda" no editor, mas o preview/e-mail real saía centralizado — "parece que ele não lê isso do banco")
- **Sintoma:** `AlignControl` (`src/components/admin/emailTemplateEditor/controls.tsx`) tinha um fallback fixo `value={value || 'left'}` pra **todo** bloco quando `align` não estava salvo. Só que o renderer de vários tipos de bloco (`header`, `cta_button`, `pix_button`, `secondary_link`, `image_with_link`, `social_icons`, `lineup`, `countdown`, `ticker`, `footer`) usa `"center"` como padrão real quando `align` está vazio (`?? "center"` em `renderBlock/{basic,interactive}.ts`). Resultado: o e-mail já saía centralizado (comportamento correto), mas o editor sempre mostrava "Esquerda" selecionado pra esses mesmos blocos — não era um bug de leitura do banco (todos os 18 usos de `AlignControl` já passavam `block.align` corretamente), era o valor de exibição padrão do controle que não batia com o padrão real de cada tipo de bloco.
- **Causa:** `AlignControl` não tinha noção de qual o alinhamento padrão de cada tipo de bloco — usava sempre `'left'` como fallback de exibição, mesmo em blocos cujo renderer real usa `'center'`. Além disso, `pix_button` e `event_grid` nem tinham `case` em `blockDefaults.ts`, então nasciam com `align: undefined` mesmo recém-criados.
- **Correção:** `AlignControl` ganhou um parâmetro opcional `defaultAlign` (`controls.tsx`), usado como `value={value ?? defaultAlign}`. Os 10 usos do controle nos blocos que centralizam por padrão (`actionProps.tsx`, `eventProps.tsx`, `structuralProps.tsx`) passam `defaultAlign="center"`. `blockDefaults.ts` ganhou os `case`s que faltavam pra `pix_button` (`align: 'center'`) e `event_grid` (`align: 'left'`). Nenhuma mudança no HTML enviado — só na exibição do editor.
- **Proteção:** `src/__tests__/regression/align-control-default-per-kind.test.ts` (guarda estática — falha se qualquer um dos 10 usos de `AlignControl` nos blocos centralizados-por-padrão perder o `defaultAlign="center"`, ou se `pix_button`/`event_grid` voltarem a faltar em `blockDefaults.ts`).

### R-035 — Quebra de linha no bloco de texto do editor não dava respiro nenhum
- **Quando:** agosto/2026 (usuário reportou que separar frases com Enter no bloco de texto livre "não funciona" — sem respiro visível entre parágrafos no e-mail)
- **Sintoma:** o editor rich-text do bloco `text` (Tiptap) gera `<p>...</p>` (Enter) e `<br>` (Shift+Enter) **sem nenhum atributo `style`**. `sanitizeCustomHtml` só remove tags perigosas (`script`/`style`/`iframe`/`on*`/`javascript:`), nunca mexeu em `<p>`/`<ul>`/`<blockquote>`/`<h2>`. Sem margem inline, clientes de e-mail (principalmente Outlook desktop, que ignora quase todo CSS não-inline) renderizavam parágrafos consecutivos colados um no outro — a estrutura HTML estava correta, só não tinha efeito visual nenhum.
- **Causa:** nenhum ponto do pipeline (`sanitizeCustomHtml`, o `case "text"` do renderer, ou o `<style>` global do template) jamais adicionou estilo inline às tags que o Tiptap produz — o HTML vindo do editor era passado direto pro e-mail sem nenhum tratamento de espaçamento.
- **Correção:** novo helper `applyEmailSafeProseStyles()` (`supabase/functions/_shared/emailBlocks/utils.ts`), chamado logo após `sanitizeCustomHtml` no `case "text"` (`renderBlock/basic.ts`). Injeta `margin`/`padding` inline em `<p>`, `<ul>`/`<ol>`/`<li>`, `<blockquote>` (com borda lateral na cor do bloco) e `<h2>` (com a mesma cor do texto) — só quando a tag ainda não tem `style=` (não sobrescreve nada custom). `<br>` não precisa de mudança, já respeita o `line-height` do container.
- **Proteção:** 6 novos casos em `supabase/functions/_shared/emailBlocks_test.ts` (parágrafo ganha margem, `<br>` não é alterado, lista/blockquote/h2 ganham estilo, tag com `style=` prévio não é sobrescrita).

### R-036 — Vários blocos de e-mail tinham textos presos no código, sem campo editável
- **Quando:** agosto/2026 (usuário duplicou "Virada de lote — múltiplos eventos" pra criar uma variante "FDS sem taxa" e viu a frase "eventos com novo lote hoje" fixa, sem jeito de editar)
- **Sintoma:** auditoria em todos os renderers (`supabase/functions/_shared/emailBlocks/renderBlock/*.ts`) achou 6 textos hardcoded sem nenhum campo por trás: o título do bloco `title` quando usado por templates `ticket_batch_multi` (`"N eventos com novo lote hoje"`, montado em `buildMultiEventAnnouncementData`), os rótulos `"Data e hora"`/`"Local"` do `event_meta`, `"📰 Leia a matéria"` do `article_summary`, `"Descadastrar-se"` do `footer`, `"Ver eventos Dedge →"` no card compacto do `dedge_block` (que ignorava o campo `primary_label` já existente), e `"Ler matéria →"` do `blog_posts_list`. Também achados: rótulos de unidade do `countdown` (`dia/dias/hora/horas/min` e o prefixo `"até"`) sem campo, e divergências entre a versão HTML e a versão texto-puro do mesmo e-mail quando um campo era deixado vazio (cada uma caía num texto padrão diferente).
- **Causa:** cada um desses textos foi escrito direto no template string do renderer no momento em que o bloco foi criado, sem previsão de que precisariam variar entre templates diferentes do mesmo tipo — gap de design, não bug de lógica.
- **Correção:** novos campos opcionais nos tipos `title` (`text_override`), `event_meta` (`date_label`, `location_label`), `article_summary` (`eyebrow_label`), `footer` (`unsubscribe_label`), `blog_posts_list` (`read_more_label`) e `countdown` (`unit_label_day/days/hour/hours/minutes`, `until_prefix`) — todos com fallback pro texto atual, então nenhum template existente muda de aparência. `dedge_block` (compact) passou a reaproveitar o campo `primary_label` que já existia mas era ignorado nesse card. Painéis de propriedades (`textProps.tsx`, `structuralProps.tsx`, `digestProps.tsx`, `eventProps.tsx`) ganharam os campos correspondentes. `renderBlockedTemplateText.ts` (versão texto-puro) teve seus fallbacks alinhados com os mesmos literais da versão HTML, incluindo esconder o cabeçalho do `event_grid` quando também está escondido no HTML.
- **Proteção:** 18 novos casos em `supabase/functions/_shared/emailBlocks_test.ts` (um por campo novo confirmando override + fallback preservado, mais 5 casos de paridade HTML/texto-puro).

### R-037 — Sobrescrever o título num template "Virada de lote — múltiplos eventos" não mudava o assunto do e-mail
- **Quando:** agosto/2026 (usuário reportou logo após a correção R-036: mesmo já tendo editado o título via o novo campo, o preview do Envio Manual continuava mostrando "2 eventos com novo lote hoje" — "não sei da onde tá vindo isso")
- **Sintoma:** R-036 adicionou `text_override` ao bloco `title`, mas só corrigiu o `<h1>` visível (`renderBlock/basic.ts`). O **assunto** do e-mail (bem visível no topo da "Revisão final" do Envio Manual) usa o placeholder `{{event_title}}`, resolvido em `composeEmail()` a partir de `event.eventTitle` — que pra templates `ticket_batch_multi` é computado por `buildMultiEventAnnouncementData()` ANTES de qualquer bloco ser renderizado, sem nenhuma ideia do que o bloco `title` tinha sobrescrito. O H1 mudava corretamente, mas o assunto continuava herdando o texto automático.
- **Causa:** dois mecanismos de override desalinhados — o do bloco (`text_override`, usado só no render do H1) e o do assunto (`{{event_title}}`, resolvido a partir de `event.eventTitle` computado bem antes, sem visibilidade do bloco).
- **Correção:** `buildMultiEventAnnouncementData()` (`supabase/functions/_shared/emailComposer.ts`) ganhou `opts.titleOverride`, usado como o próprio `eventTitle` — que agora alimenta TANTO o bloco `title` (via seu fallback já existente) QUANTO o placeholder do assunto/preheader, de uma vez só. `useManualBatch.ts` busca o bloco `title` no template selecionado e repassa seu `text_override` como `titleOverride` antes de montar a composição multi-evento.
- **Proteção:** 2 novos casos em `src/__tests__/lib/emailComposer.test.ts` (`titleOverride` sobrescreve/cai no fallback), `src/__tests__/regression/multi-event-title-override-subject-parity.test.ts` (guarda estática — falha se `useManualBatch.ts` parar de repassar o override, ou se `buildMultiEventAnnouncementData` perder o parâmetro).

### R-038 — Taxa de abertura/clique acima de 3000% no card "Detalhe por campanha"
- **Quando:** agosto/2026 (usuário reportou no Dashboard de `/admin/email-config`)
- **Sintoma:** a tabela "Detalhe por campanha" mostrava taxas de abertura/clique tipo "3420.0%" em vez de "34.2%" pra praticamente toda campanha com estatísticas carregadas.
- **Causa:** `stats.open_rate`/`click_rate` (gravados em `stats_json` pela edge `egoi-campaign-stats`, via `parseStats.ts`) já vêm como percentual pronto (0–100). A tabela passava esse valor por `rateFmt()`, uma função que espera uma **fração** (0–1) e multiplica por 100 — correta pros KPI cards (que recebem `kpis.openRateAvg`/`clickRateAvg`, frações calculadas em `aggregate()`), mas errada aqui, resultando em multiplicação dupla por 100.
- **Correção:** `EmailDashboard.tsx` ganhou `pctFmt()`, que só formata o número (já percentual) sem multiplicar, usado nas duas células da tabela. `rateFmt()` e os KPI cards não mudaram. `parseStats.ts` (cálculo do percentual na edge function) já estava correto.
- **Proteção:** `src/__tests__/regression/email-dashboard-campaign-detail-rate-percentage.test.ts` (guarda estática — falha se a tabela voltar a usar `rateFmt` nas células de open_rate/click_rate, ou se `pctFmt` ganhar uma multiplicação por 100).

### R-039 — Bloco "eyebrow" herdava copy fixa de "Novo evento" em qualquer template
- **Quando:** agosto/2026, achado durante a auditoria de consistência de todos os templates de e-mail
- **Sintoma:** ao adicionar manualmente um bloco "eyebrow" no editor (a etiqueta pequena acima do título), o texto nascia sempre como "Novo evento" — mesmo editando um template "Virada de lote" ou "Cortesia". Auditoria direta na tabela `email_templates` também achou o mesmo problema em produção: o template padrão "Novo evento — padrão" tinha o preheader salvo como placeholder nunca preenchido (`"[Ingressos com Desconto] — [Cupom MDAccula]"`), o template "FDS Sem Taxa — múltiplos eventos" tinha um `text_override` de título esquecido como `"teste"` (que também vira o assunto real do e-mail, via R-037) e misturava mensagem de "sem taxa" com preheader herdado de "lote", o template "Cortesia — oportunidade" tinha erro de concordância ("INGRESSOS LIMITADAS" em vez de "LIMITADOS"), e havia uma duplicata idêntica ("Virada de lote (cópia)").
- **Causa:** `blockDefaults.ts` fixava `text: 'Novo evento'` no bloco eyebrow independente do tipo de template sendo editado; `renderBlock/basic.ts` (backend) tinha o MESMO fallback fixo pra quando o texto vinha vazio, então mesmo corrigindo só o editor o envio real continuaria mostrando "Novo evento" sozinho.
- **Correção:** `blockDefaults.ts` agora nasce com `text: ''`; `textProps.tsx` ganhou um placeholder visual pra guiar o admin; `renderBlock/basic.ts` não renderiza mais nada quando o eyebrow está vazio (em vez de inventar texto). Conteúdo dos 4 templates de produção citados acima corrigido diretamente via SQL (preheader reescrito, `text_override` de teste removido, mensagem "sem taxa" unificada, concordância de gênero corrigida, duplicata apagada).
- **Proteção:** `src/__tests__/regression/email-eyebrow-default-context-mismatch.test.ts` (guarda estática — falha se o default do editor ou o fallback do backend voltarem a usar "Novo evento") + `supabase/functions/_shared/emailBlocks_test.ts` (2 novos casos: eyebrow sem texto, ou só espaços, não renderiza nada).

### R-040 — Métricas E-goi sempre zeradas no Dashboard de e-mails
- **Quando:** agosto/2026 (usuário reportou logo no primeiro acesso ao Dashboard após a auditoria de 17 fases: "as metricas de abertura etc do egoi estao tudo zeradas")
- **Sintoma:** `event_email_campaign_stats.stats_json` nunca era gravado pra campanha nenhuma — o Dashboard sempre mostrava 0 aberturas/cliques mesmo com campanhas realmente enviadas.
- **Causa:** `egoi-campaign-stats/index.ts` chamava `GET /campaigns/email/{id}/statistics`, um endpoint que não existe na API v3 da E-goi (404 em toda tentativa — confirmado contra os SDKs oficiais `E-goi/sdk-python` e `E-goi/sdk-javascript`; o path real é `GET /reports/email/{campaign_hash}`). Além disso, o cron de sincronização (a cada 6h) chamava a função sequencialmente por campanha sem `timeout_milliseconds` explícito no `net.http_post`, estourando o timeout padrão de 5s do pg_net antes de completar — mesmo corrigindo o endpoint, o cron nunca teria tempo de terminar. Por fim, mesmo com o endpoint certo, os campos de `EmailReportOverall` vêm aninhados sob a chave `overall` na resposta real (`{ campaign_hash, overall: { sends, opens, ... } }`), não no nível raiz como a tipagem `allOf` do SDK sugeria.
- **Correção:** path trocado pra `/reports/email/{hash}`; `parseStats.ts` lê de `overall` (com fallback pro nível raiz); loop `sync_all` passou a rodar em lotes de 4 em paralelo; migration reagenda o cron com `timeout_milliseconds: 60000`.
- **Proteção:** `supabase/functions/egoi-campaign-stats/parseStats_test.ts` (mapeamento do shape real + guarda estática contra o path antigo).

### R-041 — Envio pra um segmento específico (não "toda a lista") falhava 422 `data.isEmpty`
- **Quando:** agosto/2026, achado no histórico real da campanha "Keinemusik | 17/10" durante a investigação do R-040
- **Sintoma:** toda campanha enviada escolhendo um segmento específico (qualquer coisa diferente do padrão "toda a lista") falhava silenciosamente com erro 422 da E-goi.
- **Causa:** `sendEgoiCampaign()` (`_shared/egoiClient.ts`, compartilhado por 9 edge functions de disparo) montava `{ type: "segment", segment_id: segmentId }`, mas o schema real da E-goi pra esse tipo de segmento usa `{ type: "segment", data: [string] }` — confirmado contra `docs/OSegmentsActionSend.md` do `E-goi/sdk-javascript`.
- **Correção:** `segments = { type: "segment", data: [String(segmentId)] }`.
- **Proteção:** `supabase/functions/_shared/egoiClient_test.ts` (2 casos: com segmento e sem segmento, checando o corpo exato enviado).

### R-042 — Tooltip dos gráficos (Recharts) ilegível no tema escuro
- **Quando:** agosto/2026, achado pelo usuário no Dashboard de e-mails ("nao consigo ver os dados ao passar o mouse")
- **Sintoma:** `<Tooltip />` puro do Recharts renderiza com fundo branco/inline por padrão; como o app aplica `text-foreground` (quase branco) globalmente, o texto do tooltip ficava invisível — texto quase-branco sobre fundo branco. O mesmo bug existia em `Analytics.tsx` (público) e nos gráficos de pizza de `AIAnalyticsDashboard.tsx`.
- **Causa:** uso direto do `<Tooltip />` do Recharts sem nenhum estilo, em vez do componente compartilhado `ChartTooltip`/`ChartTooltipContent` (`@/components/ui/chart`, já correto e usado em `egressMonitor/*`).
- **Correção:** `EmailDashboard.tsx` e `Analytics.tsx` passaram a usar `ChartTooltip`/`ChartTooltipContent`; `AIAnalyticsDashboard.tsx` ganhou o mesmo `contentStyle` com tokens que os gráficos de barra/linha do próprio arquivo já usavam.
- **Proteção:** `src/__tests__/regression/email-dashboard-chart-tooltip-tokens.test.ts`.

### R-043 — "Alcance estimado" nunca mostrava a contagem de contatos de um segmento
- **Quando:** agosto/2026, achado pelo usuário na aba Configuração
- **Sintoma:** ao escolher um segmento específico, "Alcance estimado" sempre ficava em "—".
- **Causa:** o objeto "Segment" da E-goi (`GET /lists/{id}/segments`) nunca inclui contagem de contatos — confirmado contra `docs/Segment.md` do SDK oficial (só `type`, `segmentId`, `name`, `created`, `updated`, `segmentFilter`). O código tentava adivinhar 4 nomes de campo diferentes nessa resposta e sempre caía em `null`. Depois de trocar pro endpoint certo (`GET /lists/{id}/contacts/segment/{segmentId}`), ainda caía em `null` porque o SDK documenta o campo como `totalItems` (camelCase, artefato do gerador OpenAPI), mas a resposta HTTP real usa `total_items` (snake_case). O total da LISTA inteira (`GET /lists/{id}`) tinha o mesmo problema: o total vem aninhado em `stats.total_contacts`, não no nível raiz.
- **Correção:** `egoi-resources/index.ts` passou a chamar `GET /lists/{id}/contacts/segment/{segmentId}?limit=1` por segmento (função extraída em `segmentCounts.ts`), lendo `total_items`; o total da lista passou a ler `stats.total_contacts` primeiro.
- **Proteção:** `supabase/functions/egoi-resources/segmentCounts_test.ts`.

### R-044 — Automação "Blog news" nunca aparecia no Dashboard de e-mails
- **Quando:** agosto/2026, pedido de melhoria do usuário ("colocar no dashboard as metricas de todos os emails enviados em automacoes")
- **Sintoma:** Digest semanal, Agenda do FDS e Lembrete de evento já apareciam no Dashboard (a consulta não filtra por tipo), mas Blog news nunca aparecia, mesmo quando o e-mail era criado/enviado normalmente na E-goi.
- **Causa:** `blog-digest-draft/index.ts` nunca chamava `writeDigestCampaignHistory()` — não tinha como, já que essa automação não é ligada a um evento específico (agrega posts do blog) e `event_email_campaigns.event_id` era `NOT NULL`. Era a única das 4 automações sem nenhum caminho de escrita nessa tabela.
- **Correção:** migration remove o `NOT NULL` de `event_id`; `writeDigestCampaignHistory` (compartilhada com `weekly-digest-draft`/`weekend-agenda-draft`) passou a gravar 1 linha com `event_id = null` quando não há eventos, em vez de não gravar nada (corrige de brinde o caso latente de uma semana sem nenhum evento nos outros dois); `blog-digest-draft` passou a chamar essa função nos 3 pontos de saída (falha ao criar, falha ao enviar, sucesso).
- **Nota:** Digest semanal e Agenda do FDS têm o registro de histórico ligado desde 08/08/2026 mas só rodam semanalmente (terça e quinta) — não é bug elas ainda não terem nenhuma linha gravada logo depois disso, só não bateu o primeiro ciclo ainda.
- **Proteção:** `supabase/functions/_shared/digestCampaignHistory_test.ts` (atualizado) + `supabase/functions/blog-digest-draft/historyWiring_test.ts`.

### R-045 — Automação "Lembrete de evento" nunca disparava sozinha pelo cron
- **Quando:** agosto/2026, achado durante auditoria de documentação (comparando `list_edge_functions` do MCP contra `supabase/config.toml`)
- **Sintoma:** `event_reminder_cron` (roda de hora em hora) sempre reportava sucesso do lado do Postgres/`pg_net` (o POST era enviado), mas a function nunca processava nada de verdade.
- **Causa:** `send-event-reminder-campaigns` não tinha entrada em `supabase/config.toml` — sem isso, o gateway do Supabase cai no padrão `verify_jwt: true`, que exige um JWT válido *antes* de o código da function rodar. O cron só manda `x-cron-secret` (sem JWT nenhum), então a chamada era bloqueada com 401 no gateway — confirmado ao vivo via `get_logs` (`POST | 401 | .../send-event-reminder-campaigns`).
- **Correção:** `[functions.send-event-reminder-campaigns]` + `verify_jwt = false` adicionado em `supabase/config.toml`, igual ao padrão de todas as outras functions cron/webhook do projeto.
- **Proteção:** `src/__tests__/regression/send-event-reminder-cron-verify-jwt-gap.test.ts`.

### R-046 — Assunto/H1 de campanha multi-evento sempre mostrava frase genérica em vez dos nomes reais dos eventos
- **Quando:** agosto/2026, pedido do usuário ao notar que o e-mail "Virada de lote — múltiplos eventos" chegava com o assunto "2 eventos com novo lote hoje" mesmo tendo eventos reais selecionados.
- **Sintoma:** com o bloco "Título" (H1) ativo e sem nenhum override manual configurado, tanto o H1 quanto o assunto/preheader do e-mail (placeholder `{{event_title}}`) mostravam sempre a frase genérica baseada só na contagem de eventos, nunca os nomes reais.
- **Causa:** `buildMultiEventAnnouncementData()` (`supabase/functions/_shared/emailComposer.ts`) só usava `events.length` pra compor `eventTitle` — nunca lia `event.title` dos eventos selecionados. Além disso o assunto (linha única) e o H1 visível (bloco no corpo do e-mail) usavam o mesmo texto, mas têm restrições diferentes: o assunto não pode virar uma lista, o H1 pode.
- **Correção:** `composeAutoMultiEventTitle()` (usada só pro assunto/preheader) junta os títulos reais em pt-BR ("A", "A e B", "A, B e C") quando cabem num limite seguro pro assunto; se não couberem, cai direto na frase genérica original — sem etapa intermediária tipo "Primeiro e mais N eventos" (testado e descartado por ficar com leitura estranha quando o primeiro título já é longo). Separadamente, o bloco "Título" (H1) passou a listar TODOS os eventos, um por linha com marcador + dia/hora (`• BOMA presents: The Moment — 22/08 · 17h`), lendo direto de `event.gridEvents` — paridade mantida no renderer plain-text. O override manual (`text_override` no bloco título, R-037) continua tendo prioridade máxima sobre a lista.
- **Proteção:** `src/__tests__/regression/multi-event-generic-title-uses-real-event-names.test.ts`, `src/__tests__/lib/emailComposer.test.ts`, `src/__tests__/lib/blocks-title-multi-event-list.test.ts`.

### R-047 — Bloco "Ticker de urgência" (modo fade) gerava scroll horizontal no preview/e-mail quando tinha 2-3 mensagens
- **Quando:** agosto/2026, achado pelo usuário logo após a criação do novo template "Promoção" (primeiro preset a usar `ticker` com `animation: 'fade'` e 3 mensagens).
- **Sintoma:** o preview do template "Promoção" (e qualquer bloco `ticker` com `animation: 'fade'` e 2+ mensagens) ficava com barra de rolagem horizontal, diferente dos demais templates.
- **Causa:** em `renderInteractiveBlock` (`supabase/functions/_shared/emailBlocks/renderBlock/interactive.ts`, `case "ticker"`), o CSS do modo "fade" dava `display:inline` para `.tk0`, `.tk1` e `.tk2` simultaneamente (mesma especificidade do seletor `.tk{display:none}` que deveria escondê-los, então a ordem da cascata fazia os três ganharem `display:inline` ao mesmo tempo). A troca de mensagem dependia só da animação de `opacity`, mas as 3 mensagens continuavam ocupando espaço lado a lado no fluxo normal (sem separador entre elas), dentro de um container com `white-space:nowrap` — o texto combinado das 3 mensagens estourava a largura da tabela de 600px.
- **Correção:** os spans do modo fade passaram a usar `position:absolute` (dentro de `.ticker-anim{position:relative;height:18px}`), empilhados um sobre o outro — só a opacidade determina qual aparece, sem nenhum ocupar espaço em fluxo simultaneamente com os outros.
- **Proteção:** `supabase/functions/_shared/emailBlocks_test.ts` (`"ticker: modo fade com 3 mensagens empilha via position:absolute..."`).

## Checklist antes de mergear

- [ ] `npm test` verde
- [ ] `npm run test:coverage:ratchet` verde (ou aceita atualização da baseline)
- [ ] `npx tsc --noEmit` verde
- [ ] Bug de produção sendo corrigido → entrada nova em "Regressões cobertas" + teste em `__tests__/regression/`
