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

## Checklist antes de mergear

- [ ] `npm test` verde
- [ ] `npm run test:coverage:ratchet` verde (ou aceita atualização da baseline)
- [ ] `npx tsc --noEmit` verde
- [ ] Bug de produção sendo corrigido → entrada nova em "Regressões cobertas" + teste em `__tests__/regression/`
