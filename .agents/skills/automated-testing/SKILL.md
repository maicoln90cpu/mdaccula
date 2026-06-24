---
name: automated-testing
description: Testes automatizados em projetos Lovable - piramide de testes unit integration E2E contract visual a11y seguranca performance, testes de RLS por perfil, contract tests de Edge Functions validando envelope ok data error traceId, smoke tests pos-deploy, CI bloqueante com ratchet de cobertura. Acionar ao pedir testes cobertura CI regressao, bug de producao virando teste, antes de refactor grande, validar RLS contrato de API acessibilidade automatizada, adicionar CI de testes, ou quando codigo antigo da medo de mexer.
---

# Automated Testing — Rede de seguranca contra regressoes

## PASSO 0 - Inspecionar e estimar antes de qualquer implementacao (obrigatorio)

```bash
# Vitest esta configurado?
cat vite.config.ts 2>/dev/null | grep -i "test\|vitest"
ls vitest.config.ts 2>/dev/null

# Playwright esta instalado?
ls playwright.config.ts 2>/dev/null
grep "playwright" package.json 2>/dev/null

# Quantos testes existem?
find src -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" | wc -l

# Cobertura atual (se existir)
cat coverage/coverage-summary.json 2>/dev/null | head -5

# Edge Functions tem testes de contrato?
find src -name "*.test.ts" | xargs grep -l "edge\|function\|traceId" 2>/dev/null | wc -l
```

### O que fazer com cada achado

| Achado | Acao |
|---|---|
| Sem Vitest configurado | Configurar Vitest + RTL antes de qualquer teste |
| Sem testes de servicos | MODULO 1 - Unit tests |
| Sem testes de RLS | MODULO 2 - Database e RLS |
| Sem contract tests | MODULO 3 - Contract tests |
| Sem E2E | MODULO 4 - E2E com Playwright |
| Sem CI bloqueante | MODULO 5 - CI e qualidade |
| Bug de producao sem teste | MODULO 6 - Regressao |
| Regra arquitetural sem guard | Ler `references/static-guards.md` antes de escrever teste runtime |
| Suite depende de ENV/CDN/regressao nomeada/ratchet/builtin Node em script | Ler `references/robust-patterns.md` para 5 padroes comprovados |

### Preferir guard estatico quando possivel

Antes de escrever teste runtime (com rede, banco ou render), pergunte: **a regra
pode ser provada lendo o codigo-fonte?** Se sim, prefira um guard estatico
(AST/regex em arquivos do repo) — custa <1s, nao precisa de secrets, nao da
flake. Padrao detalhado em `references/static-guards.md`:

- AST/regex varrendo `supabase/functions/`, `supabase/migrations/`, `src/`.
- Baseline congelada com `Set<string>` para projeto legado (so reduz).
- Orphan check obrigatorio (baseline nao pode apontar para arquivo inexistente).
- Script `test:guards` dedicado para feedback rapido em pre-commit.
- Organizar em `__tests__/{architecture,design,contracts,database}/`.

### Estimativa de impacto

```
DIAGNOSTICO DE TESTES: [nome do projeto]

Testes existentes: X
Cobertura atual: Y%
Sem testes de RLS: sim/nao
Sem contract tests: sim/nao
Sem E2E: sim/nao

RISCO: Baixo — testes nao afetam codigo de producao
GANHO: Seguranca para refatorar e escalar

Posso comecar pela Fase 1?
```

---

## MODULO 1 - Unit e Integration tests

### Regra de ouro
**Testar comportamento, nunca implementacao. Mockar apenas nas bordas (rede, tempo, randomness). Services e hooks sao os alvos principais.**

### Analogia
E como testar um carro. Voce nao testa cada parafuso separado (implementacao) — voce testa se freia, acelera e vira (comportamento). Se trocar o parafuso por um melhor, o teste continua passando.

### Configuracao Vitest

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        lines: 60,    // minimo — aumentar gradualmente
        functions: 60,
        branches: 50,
      },
      exclude: [
        'src/__tests__/**',
        'src/integrations/**',  // tipos gerados
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
```

```ts
// src/__tests__/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock do Supabase — nunca chamar banco real em unit tests
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
    },
  },
}));
```

### Testar service layer

```ts
// src/__tests__/services/[entidade]Service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { [entidade]Service } from '@/services/[entidade]Service';
import { supabase } from '@/integrations/supabase/client';

describe('[entidade]Service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getAll retorna lista vazia quando nao ha registros', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as any);

    const result = await [entidade]Service.getAll('user-123');
    expect(result).toEqual([]);
  });

  it('create lanca erro quando !data (RLS silenciosa)', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    await expect(
      [entidade]Service.create({ title: 'Teste', user_id: 'user-123' })
    ).rejects.toThrow('Registro nao criado');
  });

  it('update retorna dado atualizado', async () => {
    const mockData = { id: '1', title: 'Atualizado', user_id: 'user-123' };
    vi.mocked(supabase.from).mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    } as any);

    const result = await [entidade]Service.update('1', { title: 'Atualizado' });
    expect(result.title).toBe('Atualizado');
  });
});
```

### Testar hooks com React Testing Library

```tsx
// src/__tests__/hooks/use[Entidade].test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { use[Entidade]s } from '@/hooks/use[Entidade]';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })}>
    {children}
  </QueryClientProvider>
);

describe('use[Entidade]s', () => {
  it('retorna lista de [entidades]', async () => {
    const { result } = renderHook(() => use[Entidade]s(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
  });
});
```

---

## MODULO 2 - Database e RLS tests

### Regra de ouro
**Toda policy RLS precisa de teste para cada perfil: anonimo, usuario comum, admin. Nunca confiar que a policy funciona sem teste que prove.**

### Analogia
RLS sem teste e como trancar a porta e nunca verificar se a chave funciona. Pode estar trancada — ou pode estar so parecendo trancada.

### Template de teste de RLS

```ts
// src/__tests__/database/rls-[tabela].test.ts
// IMPORTANTE: estes testes rodam contra o banco real (Supabase local ou staging)
// Nunca contra o banco de producao

import { createClient } from '@supabase/supabase-js';
import { describe, it, expect, beforeAll } from 'vitest';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

// Criar clientes para cada perfil
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Para testes com usuario autenticado: usar service_role para criar usuarios de teste
// e depois assinar com JWT de teste

describe('RLS - tabela [tabela]', () => {
  it('usuario anonimo nao pode ler registros', async () => {
    const { data, error } = await anonClient
      .from('[tabela]')
      .select('*')
      .limit(1);

    // RLS deve bloquear — ou retornar vazio, ou retornar erro 401
    expect(data?.length ?? 0).toBe(0);
  });

  it('usuario so ve seus proprios registros', async () => {
    // Autenticar como usuario de teste
    const { data: authData } = await anonClient.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    });

    if (!authData.user) throw new Error('Falha no login de teste');

    const { data } = await anonClient.from('[tabela]').select('user_id');

    // Todos os registros devem ser do usuario logado
    data?.forEach(row => {
      expect(row.user_id).toBe(authData.user!.id);
    });
  });
});
```

---

## MODULO 3 - Contract tests de Edge Functions

### Regra de ouro
**Toda Edge Function deve ter contrato que valida: envelope de resposta, autenticacao obrigatoria, rejeicao de payload invalido, e traceId presente.**

### Analogia
Contract test e como um inspetor de obra que verifica se a porta tem batente, dobradura e fechadura — nao importa quem construiu ou como. O contrato define o minimo que toda porta deve ter.

### Template de contract test

```ts
// src/__tests__/contracts/edge-[nome-funcao].test.ts
import { describe, it, expect } from 'vitest';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/[nome-da-funcao]`;

describe('Contract: Edge Function [nome-da-funcao]', () => {
  it('sem autenticacao deve retornar 401', async () => {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();

    // Contrato do envelope
    expect(body).toHaveProperty('ok', false);
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('traceId');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
  });

  it('payload invalido deve retornar 400', async () => {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TEST_USER_TOKEN}`,
      },
      body: JSON.stringify({}), // payload vazio = invalido
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.traceId).toBeTruthy();
  });

  it('request valido deve retornar 200 com envelope correto', async () => {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TEST_USER_TOKEN}`,
      },
      body: JSON.stringify({ /* payload valido para esta funcao */ }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty('data');
    expect(body.traceId).toBeTruthy();

    // Verificar header de trace
    expect(res.headers.get('x-trace-id')).toBeTruthy();
  });

  it('OPTIONS deve retornar headers CORS corretos', async () => {
    const res = await fetch(FUNCTION_URL, { method: 'OPTIONS' });
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });
});
```

---

## MODULO 4 - E2E com Playwright

### Regra de ouro
**E2E cobre apenas os fluxos criticos de negocio. Poucos testes, muito valor. Nunca testar o que unit test ja cobre.**

### Fluxos criticos (adaptar ao projeto)

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
});
```

```ts
// e2e/[fluxo-critico].spec.ts
import { test, expect } from '@playwright/test';

test.describe('[Fluxo critico]', () => {
  test.beforeEach(async ({ page }) => {
    // Autenticar via API (mais rapido que UI)
    await page.request.post('/auth/v1/token?grant_type=password', {
      data: {
        email: process.env.E2E_USER_EMAIL,
        password: process.env.E2E_USER_PASSWORD,
      },
    });
  });

  test('usuario consegue completar o fluxo principal', async ({ page }) => {
    await page.goto('/');
    // passos do fluxo...
    await expect(page.getByRole('heading', { name: /sucesso/i })).toBeVisible();
  });

  test('funciona em mobile (360px)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    // sem scroll horizontal
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(360);
  });
});
```

---

## MODULO 5 - CI bloqueante e qualidade

### Regra de ouro
**CI falhou = merge bloqueado. Sem excecoes. Cobertura so sobe, nunca desce (ratchet).**

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }

      - name: Install
        run: npm ci

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: Unit + Integration tests
        run: npx vitest run --coverage

      - name: Coverage ratchet (nao pode cair)
        run: node scripts/check-coverage-ratchet.mjs

      - name: Contract tests
        run: npx vitest run src/__tests__/contracts/
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          TEST_USER_TOKEN: ${{ secrets.TEST_USER_TOKEN }}
```

### Coverage ratchet

```js
// scripts/check-coverage-ratchet.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf-8'));
const current = summary.total.lines.pct;

const ratchetFile = '.coverage-ratchet.json';
const prev = existsSync(ratchetFile)
  ? JSON.parse(readFileSync(ratchetFile, 'utf-8')).lines
  : 0;

if (current < prev) {
  console.error(`Cobertura caiu: ${prev}% -> ${current}%`);
  process.exit(1);
}

writeFileSync(ratchetFile, JSON.stringify({ lines: current }));
console.log(`Cobertura ok: ${current}% (anterior: ${prev}%)`);
```

---

## MODULO 6 - Bug de producao vira teste de regressao

### Regra de ouro
**Nenhum bug de producao e corrigido sem primeiro criar o teste que o reproduz. O teste falha. A correcao faz o teste passar. Commitar os dois juntos.**

### Fluxo obrigatorio

```
1. Bug reportado: "ao salvar task com due_date null, crasha"

2. Escrever teste que reproduz o bug (vai falhar):
   it('create aceita due_date null sem crashar', async () => {
     await expect(
       [entidade]Service.create({ title: 'Teste', due_date: null })
     ).resolves.toBeDefined(); // falha aqui com o bug ativo
   });

3. Corrigir o bug (teste passa)

4. Commitar: "fix: aceitar due_date null + teste de regressao P[numero]"

5. Adicionar ao catalogo:
   // docs/TESTING.md — secao "Regressoes cobertas"
   // P[numero]: due_date null em [entidade]Service.create nao crasha
```

---

## Checklist de saida

```
CHECKLIST DE TESTES — [nome do projeto]

CONFIGURACAO
[ ] Vitest configurado com jsdom e coverage?
[ ] Mock do Supabase no setup.ts?
[ ] CI bloqueando merge em falha?

COBERTURA
[ ] Services tem testes de sucesso e falha?
[ ] Mutations testam o cenario !data (RLS silenciosa)?
[ ] RLS testada para cada perfil (anonimo, user, admin)?

CONTRACTS
[ ] Edge Functions tem contract test de envelope?
[ ] Contract testa 401, 400, 200 e OPTIONS?
[ ] traceId validado nos contracts?

E2E
[ ] Fluxo critico principal tem E2E?
[ ] E2E testado em mobile (360px)?

REGRESSAO
[ ] Ultimo bug de producao tem teste?
[ ] Coverage ratchet configurado?
```

---

## AUTO-EVOLUCAO DA SKILL (etapa obrigatoria - nao pular)

Esta etapa e OBRIGATORIA ao final de toda aplicacao desta skill. Nao e opcional.

### Passo 1 - Varrer o projeto

Procurar: patterns de teste mais robustos, helpers de mock reutilizaveis, scripts de CI mais eficientes, tipos de teste nao cobertos por esta skill.

### Passo 2 - Filtro 4 perguntas

1. E generico? 2. Sem nomes especificos? 3. Sem data/projeto? 4. So adiciona?
Qualquer nao: descartar. Todos sim: candidato.

### Passo 3 - Proposta

```
Encontrei padrao para melhorar automated-testing:
PADRAO / ONDE ENTRA / POR QUE MELHOR / TRECHO GENERICO
Deseja incorporar?
```

### Passo 4 - /skill-creator apos aprovacao

1. Executar /skill-creator
2. Atualizar esta skill especificamente
3. Apenas padroes aprovados
4. Nunca reduzir
5. Confirmar ao usuario

Se nenhum aprovado: "Nenhuma atualizacao aplicada." e encerrar.
