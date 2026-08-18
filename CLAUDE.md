# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MDAccula — web platform for a Brazilian electronic-music agency: events (incl. automated recurring events), an AI-generated blog, a Linktree-style links page, a UTM link redirector, and a DJ podcast submission program. React SPA frontend + Supabase (Lovable Cloud) backend. Full architecture reference: `README.md` (very detailed — read it before large changes). Deeper docs live in `docs/` (`SYSTEM-DESIGN.md`, `CODE_STYLE.md`, `SECURITY-AUDIT.md`, `TESTING.md`, `PRD.md`, `ROADMAP.md`, `FEATURE_MAP.md`, `DATABASE_SCHEMA.md`, `EDGE_FUNCTIONS.md`, `ONBOARDING.md`, `guides/design-system.md`) and `docs/tabelas.md` (full DB DDL).

## Commands

```bash
npm run dev                    # Vite dev server (localhost:8080)
npm run build                  # production build
npm run build:dev              # dev-mode build
npm run lint                   # ESLint (no lint:fix / format script exists — fix by hand)
npm test                       # vitest run — all unit/integration/contract tests
npm run test:watch             # vitest watch mode
npx vitest run path/to.test.ts # run a single test file
npm run test:coverage          # vitest with coverage report (coverage/)
npm run test:coverage:ratchet  # coverage + enforce .coverage-ratchet.json floor (what CI runs)
npm run test:edge              # Deno tests for supabase/functions/ (needs Deno installed)
npm run e2e                    # Playwright E2E (boots vite dev server itself)
npm run e2e:ui                 # Playwright UI mode
npx tsc --noEmit -p tsconfig.app.json   # typecheck (part of the pre-merge checklist) — the root tsconfig.json has `files: []` and only `references`, which bare `tsc --noEmit` ignores outside `--build` mode, silently checking 0 files; always pass `-p tsconfig.app.json`
```

`predev`/`prebuild` auto-run `scripts/generate-sitemap.mjs` and `scripts/generate-indexnow-keyfile.mjs` — don't invoke build steps out of order expecting those to be skipped.

Pre-merge checklist (from `docs/TESTING.md`): `npm test` green, `npm run test:coverage:ratchet` green (coverage must not drop >0.5pp — it's a versioned ratchet in `.coverage-ratchet.json`, only ever rises), `npx tsc --noEmit -p tsconfig.app.json` green, and any production bug fix gets a new entry under "Regressões cobertas" in `docs/TESTING.md` plus a test in `src/__tests__/regression/`.

## Architecture

**Frontend**: React 18 + TypeScript + Vite + Tailwind + Shadcn/UI, React Router with every page lazy-loaded in `src/App.tsx`, TanStack Query for server state. Path aliases: `@/*` → `src/*`, `@shared/*` → `supabase/functions/_shared/*` (same aliases in both `tsconfig.json` and `vitest.config.ts`).

**Backend**: Supabase/Lovable Cloud — PostgreSQL (42 tables, RLS everywhere — see `docs/DATABASE_SCHEMA.md` and `docs/tabelas.md` for full DDL), 57 Deno Edge Functions in `supabase/functions/` (see `docs/EDGE_FUNCTIONS.md` — note several admin-only functions still lack server-side auth checks, tracked in `docs/PENDENCIAS.md`), Storage for images, pg_cron for scheduled jobs (recurring events, AI article generation, log cleanup). `supabase/config.toml`, `src/integrations/supabase/client.ts`, and `src/integrations/supabase/types.ts` are auto-managed/generated — never hand-edit them.

**Barrel exports**: `src/hooks/index.ts`, `src/lib/index.ts`, `src/types/index.ts` — import from these (`@/hooks`, `@/lib`, `@/types`), not from individual files, matching the import order convention in `docs/CODE_STYLE.md` (React → external libs → UI components → hooks → lib/utils → supabase client → types → local assets).

**Images**: three-layer fallback chain — Bunny CDN (`cdn.mdaccula.com`) → Supabase Storage direct → static placeholder. Rewriting logic lives in `src/lib/imageUtils.ts` (`getOptimizedImageUrl` / `getOriginalSupabaseUrl`). Never hardcode a CDN or Supabase storage URL — always go through these helpers.

**Dates**: always parse `YYYY-MM-DD` strings with `parseLocalDate()` from `src/lib/utils.ts`, never `new Date("2025-12-25")` — the latter is UTC-interpreted and renders as the previous day in negative-offset timezones. Event visibility (recurring/scheduled events disappearing at the wrong time) is computed via `isEventVisible()` in `src/lib/eventDateHelper.ts` against `site_settings.timezone_offset` / `event_grace_hours`.

**Logging**: use the centralized `logger` from `@/lib` (`logger.debug/info/warn/error`, or a scoped logger via `logger.scope({...})`) — not `console.log`. ESLint warns on bare `console.log` (allows `console.warn`/`console.error`).

**Click/view tracking**: anonymous writes (link clicks, redirect clicks, post/event views, shares) must go through the corresponding Edge Function (`track-link-click`, `track-redirect-click`, `track-view`, `track-share`) because RLS blocks anonymous direct writes to those tables.

**Edge Functions**: every function should import shared CORS/rate-limit/timeout/response helpers from `supabase/functions/_shared/index.ts` rather than reimplementing them — see the template in `docs/CODE_STYLE.md`. ESLint does not lint `supabase/functions/` (separate Deno runtime); `npm run test:edge` runs Deno's own test runner against it. Deploy is automatic via GitHub Actions (`.github/workflows/deploy-edge-functions.yml`, official Supabase CLI) on push to `main` touching `supabase/functions/**` — never rely on the Lovable UI deployer or an MCP `deploy_edge_function` tool call as the normal path, both have a known bug that drops `_shared/` imports from the bundle. Any function that shouldn't require a logged-in Supabase user needs a `verify_jwt = false` entry in `supabase/config.toml`, or the next CLI deploy silently reverts it to requiring a JWT and breaks its cron/webhook/anonymous calls — this exact gap (missing entry → cron blocked with 401 at the gateway) happened for real with `send-event-reminder-campaigns` until 09/08/2026, so double-check this for every new cron-triggered function.

**Auth**: `useAuth` (Context) exposes `user`, `session`, `profile`, `isAdmin`. `isAdmin` is derived from the `user_roles` table via `has_role()`/`is_admin()` SQL functions (SECURITY DEFINER, avoids RLS recursion) — never trust or derive admin status from localStorage. `/admin/*` routes are gated by `ProtectedRoute` checking `isAdmin`.

## Testing layout

`src/__tests__/` is organized by kind, not by feature: `architecture/` (static guards over source code, e.g. banning inline field-list string literals that caused past regressions), `components/`, `hooks/`, `lib/`, `pages/`, `contracts/` (HTTP contract tests per Edge Function — skip automatically without `VITE_SUPABASE_URL`), `database/` (live RLS-policy proofs against real Supabase — skip without env vars, never write data), `regression/` (named after specific production bugs), `seo/`. E2E specs are in `e2e/` (Playwright, separate from Vitest). When touching `supabase/functions/`, also check for a matching file in `contracts/`.

## Conventions

- Never import `@supabase/supabase-js` directly in frontend code — always use the pre-configured client from `@/integrations/supabase/client`.
- Prefer Tailwind semantic tokens (`bg-background`, `text-primary`, etc.) over hardcoded colors — the dark neon design system is defined in `src/index.css`.
- Avoid `any`; in catch blocks type the error as `unknown` and narrow with `error instanceof Error`.
- New pages: add under `src/pages/`, then register a lazy-loaded route in `src/App.tsx` wrapped in `<PageWithError>`.
- New tables: write RLS policies, document in `docs/tabelas.md` (and `docs/DATABASE_SCHEMA.md`), and regenerate `src/integrations/supabase/types.ts` (auto-generated, don't hand-edit).


## Relatório Obrigatório ao Final de Cada Tarefa

Toda resposta de implementação DEVE seguir esta estrutura:

### 1) Antes vs Depois
Tabela ou lista clara comparando os 2 estados.

### 2) O que melhorou
Bullets curtos focados em ganho prático.

### 3) Vantagens / Desvantagens
+ Vantagens em bullets.
− Desvantagens / trade-offs em bullets.

### 4) Checklist manual de validação
- [ ] Itens acionáveis para testar no localhost:8080

### 5) Pendências
O que ficou pra depois ou sugestões futuras.

### 6) Prevenção de regressão
O que garante que isso não volte a quebrar.

### 7) Auditoria de documentação (obrigatória, rodar ANTES de escrever este relatório)
Não é um lembrete — é um passo do fluxo, com a mesma obrigatoriedade dos itens 1-6. Fazer isso mesmo que a tarefa pedida não tivesse nada a ver com documentação, e mesmo que já tenha atualizado docs "no meio" da tarefa (essa auditoria é a rede de segurança pro que passou batido). Ver seção "Documentação sempre atualizada" abaixo pro mapa completo e o passo a passo. Resumir aqui em 1-2 linhas o que foi tocado (ex.: "CHANGELOG.md + tabelas.md atualizados; PENDENCIAS.md sem itens afetados") — se a resposta for "nada foi tocado", isso só é aceitável se a auditoria não achou nada, não porque foi pulada.

REGRAS:
- Linguagem leiga, sem jargão técnico.
- Nunca executar múltiplos itens de alto risco de uma vez.
- Itens de baixo risco podem ser agrupados (máximo 3).
- Sempre validar no localhost antes de sugerir o push.
- Sugerir melhorias só do que foi implementado.
- EM TODAS ALTERAÇÕES DE CODIGO, RODAR OS TESTES NOS ARQUIVOS EDITADOS, CASO REPROVE, CORRIGIR ANTES DE ENTREGAR COMO CONCLUIDO

## Documentação sempre atualizada (sem precisar pedir)

Esta regra não depende de "lembrar" — este arquivo é recarregado do zero em toda conversa nova, em qualquer chat, então tratar isso como memória de conversa é exatamente o que falha. O mecanismo confiável é: **rodar o checklist abaixo como PASSO FINAL de qualquer tarefa que tenha gerado commit**, igual a rodar os testes — não como algo pra "se lembrar" no meio do trabalho. É o item 7 do relatório obrigatório (seção acima); nenhuma tarefa com commit está concluída sem ele.

**Passo a passo da auditoria final** (fazer isso, não só ler o mapa abaixo):
1. Rodar `git log` (ou revisar mentalmente) dos commits feitos NESTA tarefa — inclusive os que pareceram pequenos/óbvios demais pra precisar de doc (lint fix, rename, cleanup). Pra cada um, aplicar o mapa abaixo.
2. Abrir `docs/PENDENCIAS.md` e conferir se algum item ali é **resolvido, invalidado ou tocado** pelo que acabou de ser feito — mesmo que o pedido original não tivesse nada a ver com PENDENCIAS.md. Isso inclui achados que viraram falso-alarme (investigou e não era bug): remover o item, sem precisar de entrada em CHANGELOG.md se nada mudou de fato.
3. Só depois disso, escrever o item 7 do relatório.

Mapa do que atualizar em cada caso:
- **Edge function nova, removida, ou com propósito/endpoint/auth mudado** → `docs/EDGE_FUNCTIONS.md` (linha da tabela + contagem no topo do arquivo, conferida contra `list_edge_functions` do MCP, não só contra o filesystem).
- **Tabela ou coluna nova/alterada, migration aplicada** → `docs/tabelas.md` (DDL) e `docs/DATABASE_SCHEMA.md` (índice); nunca editar `src/integrations/supabase/types.ts` na mão, regenerar via MCP.
- **Bug de produção corrigido** → entrada nova em "Regressões cobertas" no `docs/TESTING.md` (já era regra) **e** entrada no `docs/CHANGELOG.md`.
- **Feature/melhoria nova entregue** → entrada no `docs/CHANGELOG.md`; se mudou rota/funcionalidade visível, também `docs/FEATURE_MAP.md`.
- **Fix de lint/CI/tooling, mesmo "pequeno demais" pra parecer que precisa de doc** → se resolve algo listado em `docs/PENDENCIAS.md`, sai de lá e vira entrada no `docs/CHANGELOG.md` (ver regra abaixo); se não estava listado e é só limpeza sem mudança de comportamento, não precisa de entrada nova, mas ainda conta pro passo 1 da auditoria (confirmar que não havia nada em PENDENCIAS.md sobre aquilo).
- **Gap ou bug real encontrado mas não corrigido na hora** (fora do escopo do pedido, ou precisa de decisão do usuário) → `docs/PENDENCIAS.md`, no tipo certo (🗳️ decisão / 🔧 bug / 👀 monitoramento — nunca um quarto tipo genérico).
- **Item de `PENDENCIAS.md` resolvido** → sai de lá e vira entrada em `CHANGELOG.md` (nunca fica registrado como "concluído" em `PENDENCIAS.md`).
- **Item de `PENDENCIAS.md` que era falso-alarme** (investigado e não é bug/gap de verdade) → sai de lá; só vira entrada em `CHANGELOG.md` se algo realmente mudou no código por causa disso, senão só remover.

Antes de escrever um número (contagem de tabelas, de edge functions, etc.) num doc, confirmar contra o estado real (MCP do Supabase, filesystem) em vez de copiar o que já estava escrito — docs de schema/contagem ficam defasados silenciosamente conforme migrations/functions são criadas sem atualização manual.