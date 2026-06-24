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

## Checklist antes de mergear

- [ ] `npm test` verde
- [ ] `npm run test:coverage:ratchet` verde (ou aceita atualização da baseline)
- [ ] `npx tsc --noEmit` verde
- [ ] Bug de produção sendo corrigido → entrada nova em "Regressões cobertas" + teste em `__tests__/regression/`
