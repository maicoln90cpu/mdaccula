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
| `npm run e2e` | Playwright (precisa do app rodando). | Antes de release. |
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
