# E2E com Playwright

Cobrir apenas jornadas de alto valor. E2E é caro — não substituir unit por E2E.

## Fluxos mínimos a cobrir

- Login + logout.
- Cadastro (se aplicável).
- CRUD principal do produto (criar → ler → editar → excluir).
- Ação principal de valor (checkout, publicação, envio, etc.).
- Recuperação de senha (se existir).

## Padrões

```ts
import { test, expect } from "@playwright/test";

test("usuário cria post", async ({ page }) => {
  await page.goto("/auth");
  await page.getByTestId("email").fill("user@test.dev");
  await page.getByTestId("password").fill("pwd123!");
  await page.getByTestId("submit").click();

  await page.getByTestId("new-post").click();
  await page.getByTestId("post-title").fill("Olá");
  await page.getByTestId("post-save").click();

  await expect(page.getByTestId("post-item")).toContainText("Olá");
});
```

Regras:
- **Selectors estáveis**: `data-testid`, nunca `.css-xyz123`.
- Headless no CI, headed local p/ debug (`--headed --debug`).
- Sem `waitForTimeout(ms)`. Use `waitFor`/`expect.toBeVisible`.
- Dados isolados por execução (e-mail com timestamp, tenant descartável).
- Mobile + desktop quando o fluxo for crítico em ambos (`devices['iPhone 13']`).

## Anti-padrões

- E2E para validar formato de moeda → unit resolve.
- E2E que depende de e-mail real → use mailbox de teste (mailpit, Mailosaur).
- E2E que loga via UI a cada teste → faça login uma vez em `storageState`.
