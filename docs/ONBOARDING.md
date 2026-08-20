# Onboarding

Guia para configurar e entender o projeto em menos de um dia. Para arquitetura em profundidade, ver
`docs/SYSTEM-DESIGN.md`; para convenções de código, `docs/CODE_STYLE.md`; para o `CLAUDE.md` na raiz
(guia rápido pensado pra ferramentas de IA, mas também útil pra humano).

## 1. O que é o projeto

MDAccula é a plataforma web de uma agência de música eletrônica brasileira: gestão de eventos
(incluindo eventos recorrentes automatizados), blog gerado por IA, uma página estilo Linktree,
redirecionador de links com UTM, e um programa de submissão de DJs para podcast. Frontend React SPA
+ backend Supabase (Lovable Cloud). Ver `docs/PRD.md` para o produto completo e `docs/FEATURE_MAP.md`
para o mapa de todas as rotas/funcionalidades.

## 2. Setup local

```bash
npm install
npm run dev          # http://localhost:8080
```

Variáveis de ambiente necessárias (`.env`/`.env.local`, não versionados): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, e as chaves do connector do Google Maps
(`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_*`) — peça os valores reais a quem já tem acesso ao projeto
Supabase; não existe um `.env.example` no repositório ainda (oportunidade de melhoria futura).

`predev`/`prebuild` rodam automaticamente `scripts/generate-sitemap.mjs` e
`scripts/generate-indexnow-keyfile.mjs` — não pule etapas de build esperando que sejam puladas.

## 3. Comandos essenciais

```bash
npm run dev                    # Vite dev server
npm run build                  # build de produção
npm run lint                   # ESLint (sem lint:fix — corrigir manualmente)
npm test                       # vitest — todos os testes unit/integration/contract
npm run test:coverage:ratchet  # coverage + trava o piso de .coverage-ratchet.json (o que o CI roda)
npm run test:edge              # testes Deno de supabase/functions/ (precisa do Deno instalado)
npm run e2e                    # Playwright E2E
npx tsc --noEmit -p tsconfig.app.json   # typecheck — o tsconfig.json raiz tem files:[] e só
                                         # references, que o tsc ignora fora de --build; sem
                                         # -p tsconfig.app.json o comando checa 0 arquivos
```

**Checklist antes de qualquer PR** (de `docs/TESTING.md`): `npm test` verde, `npm run
test:coverage:ratchet` verde (cobertura nunca pode cair mais de 0.5pp), `npx tsc --noEmit -p
tsconfig.app.json` verde, e
todo bug de produção corrigido ganha uma entrada em "Regressões cobertas" (`docs/TESTING.md`) + um
teste em `src/__tests__/regression/`.

## 4. Como o código está organizado

- **Frontend**: React 19 + TypeScript + Vite + Tailwind + Shadcn/UI. Toda página é lazy-loaded em
  `src/App.tsx` (ver `docs/FEATURE_MAP.md` para a lista completa de rotas). TanStack Query pra estado
  de servidor.
- **Aliases**: `@/*` → `src/*`, `@shared/*` → `supabase/functions/_shared/*` (mesmo alias em
  `tsconfig.json` e `vitest.config.ts`).
- **Barrel exports**: importe de `@/hooks`, `@/lib`, `@/types` (não do arquivo individual) — ver
  ordem de imports em `docs/CODE_STYLE.md`.
- **Backend**: Supabase/Lovable Cloud — Postgres (42 tabelas, RLS em todas — `docs/DATABASE_SCHEMA.md`),
  57 Edge Functions Deno (`docs/EDGE_FUNCTIONS.md`), Storage, pg_cron para jobs agendados.
  `supabase/config.toml`, `src/integrations/supabase/client.ts` e
  `src/integrations/supabase/types.ts` são auto-gerados — nunca editar à mão.
- **Design system**: dark neon, tokens em `src/index.css` — ver `docs/guides/design-system.md`.

## 5. Regras que quebram coisas se ignoradas

- **Datas**: sempre `parseLocalDate()` (`src/lib/utils.ts`) pra strings `YYYY-MM-DD`, nunca `new
  Date("2025-12-25")` direto (UTC-interpretado, quebra em timezones negativos).
- **Imagens**: sempre pelos helpers de `src/lib/imageUtils.ts` (`getOptimizedImageUrl` /
  `getOriginalSupabaseUrl`) — nunca hardcodar URL de CDN/Storage. Fallback em 3 camadas: Bunny CDN →
  Supabase Storage → placeholder estático.
- **Tracking anônimo** (cliques, views, shares) sempre via Edge Function — RLS bloqueia escrita
  anônima direta nas tabelas de evento.
- **Deploy de Edge Function**: automático via GitHub Actions ao dar push tocando
  `supabase/functions/**`. Nunca usar o deployer da Lovable UI nem o MCP `deploy_edge_function` —
  ambos têm bug conhecido que derruba imports de `_shared/`.
- **Admin**: `isAdmin` sempre deriva de `user_roles` via `has_role()`/`is_admin()` (SECURITY DEFINER),
  nunca de localStorage.
- **Logging**: `logger` centralizado de `@/lib`, não `console.log` (ESLint avisa).

## 6. Onde cada dúvida tem resposta

| Dúvida | Documento |
|--------|-----------|
| Como a arquitetura funciona por baixo? | `docs/SYSTEM-DESIGN.md` |
| Que rotas/funcionalidades existem? | `docs/FEATURE_MAP.md` |
| Como o banco é modelado? | `docs/DATABASE_SCHEMA.md` (índice) + `docs/tabelas.md` (DDL, com gaps conhecidos) |
| O que cada Edge Function faz? | `docs/EDGE_FUNCTIONS.md` |
| Convenção de código/estilo? | `docs/CODE_STYLE.md` |
| Tokens visuais/componentes? | `docs/guides/design-system.md` |
| Como testar? | `docs/TESTING.md` |
| Segurança/RLS? | `docs/SECURITY-AUDIT.md` |
| O que já foi feito? | `docs/CHANGELOG.md` |
| O que está em aberto agora? | `docs/PENDENCIAS.md` |
| O que está planejado (ainda não construído)? | `docs/ROADMAP.md` |
| Visão de produto? | `docs/PRD.md` |
