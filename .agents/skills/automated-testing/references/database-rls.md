# Database, RPC e RLS

## Setup

- Container Postgres ou Supabase local.
- Migrations rodam em `globalSetup`.
- Cada teste em transaction com rollback, ou schema descartável por execução.

## RLS testado por perfil

Para cada tabela protegida, crie 3 clientes:

```ts
import { createClient } from "@supabase/supabase-js";

const anon = createClient(URL, ANON_KEY);
const userA = createClient(URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${tokenA}` } } });
const admin = createClient(URL, SERVICE_ROLE_KEY); // bypass RLS, só p/ setup
```

Casos mínimos por tabela:

| Quem | Ação | Esperado |
|---|---|---|
| anon | SELECT | bloqueado (ou apenas linhas públicas) |
| userA | SELECT própria linha | permitido |
| userA | SELECT linha de userB | bloqueado |
| userA | UPDATE linha de userB | bloqueado |
| userA | INSERT com `user_id` de userB | bloqueado |
| admin (via `has_role`) | tudo | permitido |

Multi-tenant: repetir com `tenant_id`.

## Funções SQL e RPC

- Testar cada `security definer` function com inputs limítrofes.
- Testar `has_role` retorna corretamente para cada combinação.
- Verificar `GRANT`s em tabelas novas (sem GRANT → permission denied).

## Migrations

- Rodar migration → snapshot do schema → comparar com baseline.
- Testar rollback (se houver) ou compatibilidade forward-only.
- Seed mínimo separado de seed de demo.
