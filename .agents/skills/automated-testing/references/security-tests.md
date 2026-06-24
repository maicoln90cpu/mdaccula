# Testes de Segurança

## AuthN / AuthZ

Para cada endpoint sensível, testar matriz:

| Caller | Esperado |
|---|---|
| sem token | 401 |
| token expirado | 401 |
| usuário sem permissão | 403 |
| usuário com permissão | 200 |
| admin | 200 |

```ts
it("DELETE /posts/:id exige dono ou admin", async () => {
  await expect(deletePost.callAsUser(userB, postOfA.id)).rejects.toMatchObject({ status: 403 });
  await expect(deletePost.callAsUser(userA, postOfA.id)).resolves.toMatchObject({ ok: true });
});
```

## Multi-tenant

- Usuário do tenant A nunca vê/altera dado do tenant B.
- Testar via cliente Supabase autenticado, NÃO via service role.

## Validação server-side

- Payload com campo extra → rejeitado (Zod strict).
- Tipo errado → rejeitado.
- String com SQL injection clássico → tratada como dado, nunca executada.
- Upload > limite → rejeitado.

## Rate limit

- Endpoint público com rate limit: 1ª chamada ok, Nª chamada 429.
- Headers `Retry-After` presentes.

## Secrets

- Buscar em snapshots, fixtures e logs por padrões: `sk_`, `service_role`, `Authorization: Bearer`, chaves OpenAI, etc.
- Test fixture nunca contém secret real — usar placeholder e `process.env.TEST_*`.
