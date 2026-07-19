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

## Checklist antes de mergear

- [ ] `npm test` verde
- [ ] `npm run test:coverage:ratchet` verde (ou aceita atualização da baseline)
- [ ] `npx tsc --noEmit` verde
- [ ] Bug de produção sendo corrigido → entrada nova em "Regressões cobertas" + teste em `__tests__/regression/`
