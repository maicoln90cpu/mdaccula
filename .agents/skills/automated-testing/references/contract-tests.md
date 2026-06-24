# Contract Tests

Garantem que entrada/saída de Edge Functions, server functions, RPCs e APIs externas seguem o contrato declarado.

## Envelope padrão

```ts
type ApiResult<T> =
  | { ok: true; data: T; traceId: string }
  | { ok: false; error: { code: string; message: string }; traceId: string };
```

Todo handler retorna este shape. Teste valida com Zod:

```ts
import { z } from "zod";

const Envelope = <T extends z.ZodTypeAny>(data: T) =>
  z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), data, traceId: z.string() }),
    z.object({
      ok: z.literal(false),
      error: z.object({ code: z.string(), message: z.string() }),
      traceId: z.string(),
    }),
  ]);

it("getUser retorna envelope válido", async () => {
  const res = await getUser({ data: { id: "u1" } });
  expect(() => Envelope(z.object({ id: z.string() })).parse(res)).not.toThrow();
});
```

## Smoke com payload válido e inválido

Para cada endpoint:
- 1 chamada válida → `ok: true` + shape correto.
- 1 chamada inválida (campo faltando/tipo errado) → `ok: false` + `code` esperado.
- 1 chamada não autenticada (quando aplicável) → 401.

## Códigos de erro padronizados

Mantenha enum centralizado (`UNAUTHORIZED`, `VALIDATION_FAILED`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_ERROR`). Teste cobre cada código.

## OpenAPI / SDL

Se houver schema declarado, gere tipos e teste que o handler bate com o schema (ex.: `zod-to-openapi`).
