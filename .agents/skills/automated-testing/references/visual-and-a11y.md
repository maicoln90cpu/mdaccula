# Visual & Acessibilidade

## Visual regression

- Screenshot por breakpoint (mobile 375, tablet 768, desktop 1280, wide 1920).
- Telas críticas: home, login, checkout, dashboard, formulário principal.
- Estados: `loading`, `empty`, `error`, `success`.
- Tolerância de pixel ajustada (`maxDiffPixelRatio: 0.01`) para não virar flaky.

```ts
test("home @ mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page).toHaveScreenshot("home-mobile.png", { maxDiffPixelRatio: 0.01 });
});
```

## Snapshot com critério

- Snapshot apenas para estruturas pequenas e estáveis.
- Nunca snapshot de árvore inteira com IDs aleatórios.
- Sempre acompanhar com assertion explícita.

## Acessibilidade (axe-core)

```ts
import AxeBuilder from "@axe-core/playwright";

test("home sem violações WCAG AA", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

Cobertura mínima:
- Cada rota crítica passa em `axe` (WCAG 2.1 AA).
- Navegação por teclado: Tab/Shift+Tab percorre em ordem lógica.
- Foco visível em modal/drawer/menu, e retorna ao trigger ao fechar.
- Labels, roles e mensagens de erro associadas a inputs (`aria-describedby`).
- Contraste auditado quando há tema custom.
