# Static Guards e Frozen Baselines — padrao de baixo custo

Quando uma regra arquitetural pode ser provada lendo o codigo-fonte (sem rede,
sem banco, sem render), prefira um **guard estatico** a um teste runtime. Custo
muito menor, zero flakiness, roda em pre-commit.

## Quando aplicar

- Toda Edge Function deve tratar CORS, autenticar, usar helper de resposta.
- Toda tabela publica deve ter RLS + POLICY + GRANT na migration.
- UI nao pode importar cliente de banco direto.
- Mutations defensivas devem usar `.maybeSingle()` ao inves de `.single()`.
- Tokens de design (cores, radius, shadow, z-index) nao podem ser hardcoded.

Heuristica: se a regra e expressa como "todo arquivo que..., deve...", e
candidato a guard estatico.

## Padrao 1 — Guard com AST/regex

```ts
// src/__tests__/<area>/<nome>Guard.test.ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function listTargets(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(/* filtro de elegibilidade */);
}

describe("<nome> Guard", () => {
  it("descobriu arquivos para auditar", () => {
    expect(listTargets("<dir>").length).toBeGreaterThan(0);
  });

  it("todo <alvo> segue a regra (ou esta na baseline)", () => {
    const violations = listTargets("<dir>")
      .filter((f) => !respeitaRegra(readFileSync(f, "utf8")))
      .filter((f) => !BASELINE.has(f));
    expect(violations, `Violacoes:\n${violations.join("\n")}`).toEqual([]);
  });
});
```

Custo tipico: <500ms para varrer ~200 arquivos. Sem secrets, sem rede.

## Padrao 2 — Frozen baseline com Set

Em projeto legado a regra falha em N arquivos hoje. Congelar a baseline permite
**bloquear novas violacoes** sem precisar refatorar tudo de uma vez.

```ts
/**
 * Baseline congelada — arquivos que ainda nao seguem a regra.
 * Reduzir e bem-vindo; crescer exige decisao consciente.
 */
const BASELINE = new Set<string>([
  "legacy-file-a",
  "legacy-file-b",
]);
```

Regras de uso:
- Comentario explica o porque de cada baseline existir.
- Documentar como sair da baseline (refatorar X, Y, Z).
- Reduzir a baseline quando refatorar legado — nunca crescer silenciosamente.
- Se o time precisa adicionar entrada, deve justificar no PR.

## Padrao 3 — Orphan check obrigatorio

Sem este teste, a baseline vira lixo: entradas apontam para arquivos que ja nao
existem, mascarando regressoes futuras.

```ts
it("baselines nao contem arquivos que nao existem mais", () => {
  const present = new Set(listTargets("<dir>"));
  const orphans = [...BASELINE].filter((f) => !present.has(f));
  expect(
    orphans,
    `Baseline contem arquivos inexistentes. Remova das constantes:\n${orphans.join("\n")}`,
  ).toEqual([]);
});
```

Adicionar este teste em **todo** guard com baseline. Sem excecao.

## Padrao 4 — Script `test:guards` dedicado

Guards estaticos sao rapidos (<2s para todos juntos). Expor um script
dedicado permite rodar so eles em pre-commit ou em loop curto de dev:

```json
// package.json
{
  "scripts": {
    "test:guards": "vitest run src/__tests__/architecture src/__tests__/design src/__tests__/contracts src/__tests__/database"
  }
}
```

Beneficios:
- Pre-commit hook (husky/lefthook) roda so `test:guards` — feedback em segundos.
- CI pode rodar `test:guards` antes da suite completa (fail-fast).
- Onboarding: novo dev roda `npm run test:guards` e ve toda a regra do projeto.

## Organizacao recomendada

```
src/__tests__/
  architecture/   # imports proibidos, camadas, padroes de codigo
  design/         # tokens (cor, radius, shadow, z-index, spacing, motion)
  contracts/      # envelope de Edge Functions, CORS, auth
  database/       # RLS, POLICY, GRANT a partir das migrations
```

Separacao por "categoria de regra" facilita: 1) achar onde adicionar guard novo,
2) rodar so a categoria em desenvolvimento, 3) revisar PR por escopo.
