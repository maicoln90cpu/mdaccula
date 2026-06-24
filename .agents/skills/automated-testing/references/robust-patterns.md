# Padroes robustos comprovados em campo

Padroes genericos extraidos de projetos reais, validados pelo filtro dos 4 criterios
(generico, sem nomes especificos, sem data/projeto, so adiciona). Use-os sempre que
o cenario correspondente aparecer.

## 1. `describe.skipIf(!ENV)` para suites que dependem de ambiente

Suites de contract test e RLS dependem de variaveis (`SUPABASE_URL`, tokens). Em
maquinas sem essas variaveis (CI sem secrets, contribuidor externo), elas devem
ser puladas — nunca falhar.

```ts
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ENABLED = !!SUPABASE_URL;

describe.skipIf(!ENABLED)('Contract: edge function X', () => {
  it('...', async () => { /* ... */ });
});
```

Vantagem sobre `if (!ENV) return`: o Vitest mostra a suite como **skipped**
explicitamente no relatorio, em vez de "0 tests" silencioso.

## 2. Validar corpo da resposta em vez de `content-type` em testes de CDN

CDNs (Cloudflare, Bunny) renegociam `content-type` por client (ex.: `text/plain`
ao inves de `application/xml`). Asserts em header geram flake.

```ts
// FRAGIL — pode falhar atras de CDN
expect(res.headers.get('content-type')).toContain('application/xml');

// ROBUSTO — valida o conteudo real
const body = await res.text();
expect(body).toContain('<?xml');
expect(body).toContain('<urlset');
```

Regra: em endpoints publicos servidos por CDN, validar o **body**. Header so
quando ele e a feature sendo testada (ex.: CORS, cache-control).

## 3. Lista congelada + erro nomeado para regressao

Quando um bug surge porque alguem removeu/renomeou um campo de uma lista de
selecao, congele a lista com `as const` e crie teste cujo `expect` cita o ID da
regressao e o caminho da doc.

```ts
// src/lib/xPublicFields.ts
export const X_PUBLIC_FIELDS = ['id', 'title', 'description', 'subtitle'] as const;

// src/__tests__/regression/x-fields.test.ts
it('R-001: campos publicos nao podem ser removidos', () => {
  ['description', 'subtitle'].forEach(f => {
    expect(X_PUBLIC_FIELDS).toContain(f);
    // Mensagem do erro aponta para o catalogo
  });
});
```

A mensagem do `expect` falhando deve permitir ao proximo dev achar `docs/TESTING.md`
secao "Regressoes cobertas" sem investigar.

## 4. Coverage ratchet com tolerancia em 4 metricas

Ratchet com tolerancia (`0.5pp`) evita falsos negativos quando refactor remove
codigo morto (cobertura sobe matematicamente mas pode oscilar). Cobrir 4 metricas
(lines, statements, functions, branches) capta regressoes que so aparecem em uma.

```js
// scripts/check-coverage-ratchet.mjs
const TOLERANCE = 0.5; // pontos percentuais
const METRICS = ['lines', 'statements', 'functions', 'branches'];

for (const m of METRICS) {
  const cur = summary.total[m].pct;
  const prev = baseline[m] ?? 0;
  if (cur < prev - TOLERANCE) {
    console.error(`${m}: ${prev}% -> ${cur}% (queda > ${TOLERANCE}pp)`);
    process.exit(1);
  }
  baseline[m] = Math.max(prev, cur); // ratchet so sobe
}
```

## 5. `@vite-ignore` + `import()` dinamico para builtins do Node em scripts

Scripts em `scripts/*.mjs` rodam em Node mas, quando importados de codigo que o
Vite tambem analisa, Rollup tenta resolver builtins (`node:fs`, `node:path`) no
bundle do browser e quebra o build.

```js
// FALHA no build do Vite
import { readFileSync } from 'node:fs';

// PASSA — Vite ignora a analise estatica
const { readFileSync } = await import(/* @vite-ignore */ 'node:fs');
```

Use somente em arquivos `.mjs` chamados por CLI (CI, npm scripts), nunca em
codigo importado pela app.
