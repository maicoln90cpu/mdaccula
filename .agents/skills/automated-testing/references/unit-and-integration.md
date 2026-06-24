# Unit & Integration

## Unit (Vitest)

```ts
// src/lib/pricing.test.ts
import { describe, it, expect } from "vitest";
import { applyVAT } from "./pricing";

describe("applyVAT", () => {
  it.each([
    { price: 100, rate: 0.2, expected: 120 },
    { price: 0, rate: 0.2, expected: 0 },
    { price: 50.5, rate: 0.1, expected: 55.55 },
  ])("price=$price rate=$rate → $expected", ({ price, rate, expected }) => {
    expect(applyVAT(price, rate)).toBeCloseTo(expected, 2);
  });
});
```

Regras:
- Tabela de casos para funções puras.
- Edge cases explícitos: 0, negativos, null/undefined, overflow, unicode.
- `expect.assertions(n)` em testes async com branches.

## Hooks (React Testing Library)

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUser } from "./useUser";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

it("carrega usuário", async () => {
  const { result } = renderHook(() => useUser("u1"), { wrapper });
  await waitFor(() => expect(result.current.data?.id).toBe("u1"));
});
```

## Integration

- Banco de teste real (Postgres em container ou Supabase local).
- Migrations rodam no `globalSetup`.
- Fixtures/factories centralizadas em `tests/factories/`.
- Cada teste limpa o que criou (transaction rollback ou `truncate`).

```ts
// tests/factories/user.ts
export const makeUser = (over: Partial<User> = {}) => ({
  id: crypto.randomUUID(),
  email: `u${Date.now()}@test.dev`,
  role: "user",
  ...over,
});
```

## Mocks só nas bordas

- ✅ Mockar `fetch`, relógio (`vi.useFakeTimers`), randomness.
- ❌ Mockar a função que você está testando.
- ❌ Mockar tudo "pra ficar rápido" — perde valor.
