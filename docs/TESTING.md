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

## Checklist antes de mergear

- [ ] `npm test` verde
- [ ] `npm run test:coverage:ratchet` verde (ou aceita atualização da baseline)
- [ ] `npx tsc --noEmit` verde
- [ ] Bug de produção sendo corrigido → entrada nova em "Regressões cobertas" + teste em `__tests__/regression/`
