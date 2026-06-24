# TanStack Start + Lovable Cloud — particularidades

## Server functions (`createServerFn`)

- Testar a função importando-a diretamente (é só uma função RPC). Em testes Node, simular o contexto:

```ts
import { getUser } from "@/lib/users.functions";

it("getUser retorna dado válido", async () => {
  const res = await getUser({ data: { id: "u1" } });
  expect(res.id).toBe("u1");
});
```

- Funções com `.middleware([requireSupabaseAuth])` exigem header de auth. Em teste, gere JWT de teste via Supabase admin ou monte um mock do middleware com `vi.mock`.

## Loaders

- Loader em rota pública: testar isoladamente (é função pura sobre `context`).
- Loader sob `_authenticated/`: testar com QueryClient + sessão simulada.
- Nunca testar loader chamando rota via SSR no Vitest — use unit + E2E.

## Worker runtime (server-side)

- Lembrar: `child_process`, `sharp`, `fs.watch` NÃO funcionam no runtime de produção.
- Teste local roda em Node e pode mascarar isso → adicione 1 smoke E2E contra build de produção (`vite build` + preview) para cada server function crítica.

## Clientes Supabase nos testes

| Uso | Cliente | Chave |
|---|---|---|
| Setup/teardown (bypass RLS) | `supabaseAdmin` | `service_role` |
| Simular usuário logado | `createClient` + JWT do usuário | `anon` + Authorization |
| Simular visitante | `createClient` | `anon` |

Nunca usar service_role para validar RLS — RLS é bypassada.

## Routing e navegação em E2E

- Rotas são tipadas. Se uma rota não existir, o link nem compila — bom para evitar 404 em E2E.
- Use `page.goto("/rota")` direto; `<Link>` é detalhe de implementação.

## File-based routes em teste

- Não tente renderizar `__root.tsx` isoladamente em Vitest — depende de `Scripts`/`HeadContent` do TanStack. Para teste de UI de página, extraia o componente puro do route file e teste-o separado.
