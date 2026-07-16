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

## Checklist antes de mergear

- [ ] `npm test` verde
- [ ] `npm run test:coverage:ratchet` verde (ou aceita atualização da baseline)
- [ ] `npx tsc --noEmit` verde
- [ ] Bug de produção sendo corrigido → entrada nova em "Regressões cobertas" + teste em `__tests__/regression/`
