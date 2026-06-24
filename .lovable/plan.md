
# Aplicação da skill automated-testing — mdaccula

## Diagnóstico atual (PASSO 0)

| Item | Status hoje | Observação |
|---|---|---|
| Vitest + jsdom + setup | ✅ Existe | `vitest.config.ts` + `src/__tests__/setup.ts` com mock do Supabase |
| Playwright E2E | ✅ Existe | `e2e/` com smoke, admin, seo, event-detail |
| Testes unit/integration | ✅ 23 arquivos | hooks, lib, components, pages, seo, architecture |
| Guards estáticos (architecture) | ✅ Existe | `event-select-fields.test.ts` + `seo-contract.test.ts` |
| **Contract tests de Edge Functions** | ❌ Faltando | 31 funções sem teste de envelope/401/400 |
| **Testes de RLS por perfil** | ❌ Faltando | Nenhum teste prova policies de `events`, `blog_posts`, `user_roles` |
| **Coverage thresholds no Vitest** | ❌ Faltando | Sem mínimo; sem barrar regressão |
| **Coverage ratchet** | ❌ Faltando | Cobertura pode cair sem alerta |
| **CI bloqueante** | ❌ Frouxo | `vitest`, `prettier`, `depcheck`, `deno test` todos com `continue-on-error: true` |
| Catálogo de regressões | ⚠️ Parcial | Bugs corrigidos (descrição evento) não estão listados como “regressão coberta” |

**Risco geral:** baixo — apenas adiciona infraestrutura de teste, não toca código de produção.

---

## Plano em 6 fases (cada fase é um deploy independente e reversível)

### Fase 1 — Reforçar Vitest (thresholds + ratchet)
- Adicionar `coverage.reporter: ['text','json-summary','html']` e `thresholds` iniciais conservadores (lines 30 / functions 30 / branches 25) — baseline atual, sem forçar nada.
- Criar `scripts/check-coverage-ratchet.mjs` + arquivo `.coverage-ratchet.json` versionado.
- **Antes vs depois:** hoje cobertura pode cair silenciosamente; depois CI falha se cair.
- **Validação manual:** rodar `npx vitest run --coverage` localmente; conferir que `.coverage-ratchet.json` é criado.

### Fase 2 — CI bloqueante (remover `continue-on-error` dos jobs críticos)
- Tirar `continue-on-error: true` de: testes Vitest, Prettier check. Manter para `depcheck` e `deno test` (ainda em adoção).
- Adicionar step do ratchet após o coverage.
- **Antes vs depois:** PR com teste quebrado hoje passa; depois é bloqueado.
- **Pendência futura:** habilitar depcheck e deno bloqueantes quando estabilizarem.

### Fase 3 — Estrutura de pastas e contract tests piloto
- Criar `src/__tests__/contracts/` e `src/__tests__/database/`.
- Piloto de contract test: `edge-indexnow-notify.test.ts` e `edge-sitemap.test.ts` (envelope, 401 sem auth, OPTIONS/CORS, traceId).
- Como rodam contra URL real, marcar com `describe.skipIf(!process.env.VITE_SUPABASE_URL)` para não quebrar CI sem secret.
- **Antes vs depois:** zero contratos hoje; depois temos template replicável para as outras 29 funções.

### Fase 4 — Regressão do bug recente (evento/descrição)
- Adicionar `src/__tests__/regression/event-description-persistence.test.ts` que falha se `EVENT_PUBLIC_FIELDS` perder qualquer campo crítico OU se `useEvents`/`EventDetail` voltarem a usar string literal (reforço ao guard existente).
- Atualizar `docs/TESTING.md` (criar se não existir) com seção “Regressões cobertas” — entrada: descrição/subtitle sumindo no modal e slug.
- **Prevenção permanente:** guard + entrada documentada = bug não volta sem alerta.

### Fase 5 — Teste de RLS piloto (auth-only)
- Criar `src/__tests__/database/rls-events.test.ts` cobrindo: anônimo só lê `status='published'`; admin lê todos.
- Mesmo padrão `skipIf` sem secret; rodar contra Supabase do projeto via secrets do GitHub.
- **Antes vs depois:** policies sem prova viva; depois temos rede de segurança quando alguém alterar RLS.

### Fase 6 — Catálogo e checklist de saída
- Criar `docs/TESTING.md` com: como rodar, o que cobre, regressões catalogadas, checklist da skill.
- Adicionar badge / seção no README apontando para `docs/TESTING.md`.

---

## Detalhes técnicos

```text
Arquivos novos:
  scripts/check-coverage-ratchet.mjs
  .coverage-ratchet.json
  src/__tests__/contracts/edge-indexnow-notify.test.ts
  src/__tests__/contracts/edge-sitemap.test.ts
  src/__tests__/database/rls-events.test.ts
  src/__tests__/regression/event-description-persistence.test.ts
  docs/TESTING.md

Arquivos editados:
  vitest.config.ts            (+ thresholds, + json-summary)
  .github/workflows/ci.yml    (- continue-on-error nos críticos, + step ratchet)
```

Política de execução das fases:
- Cada fase é um commit/preview isolado.
- Antes de avançar para a próxima, você valida manualmente e aprova.
- Qualquer fase pode ser revertida sem afetar as outras.

---

## Pendências assumidas (não cobertas neste plano)
- Replicar contract tests para as outras 29 Edge Functions (fica como esteira).
- Expandir RLS tests para `blog_posts`, `custom_links`, `user_roles`.
- Subir thresholds de cobertura gradualmente conforme novos testes entram.

---

## Etapa obrigatória pós-aplicação: AUTO-EVOLUÇÃO DA SKILL
Ao final da Fase 6 vou:
1. Varrer o projeto procurando padrões superiores (ex.: padrão `@vite-ignore` para dynamic import de Node builtins em testes; padrão `EVENT_PUBLIC_FIELDS` como “select-constants” genérico; padrão `skipIf(env)` para contracts).
2. Filtrar pelos 4 critérios (genérico / sem nomes / sem data / só adiciona).
3. Apresentar a você as propostas aprovadas.
4. Somente após sua aprovação explícita, acionar `/skill-creator` para atualizar a skill `automated-testing`.

Posso seguir pela Fase 1?
