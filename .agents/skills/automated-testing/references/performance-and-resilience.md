# Performance & Resiliência

## Smoke de performance

- Mede tempo de fluxo crítico em CI (login < 2s, primeira renderização < 1s).
- Orçamento de bundle: alerta quando JS inicial cresce > 10% vs baseline.

```ts
test("login dentro do orçamento", async ({ page }) => {
  const start = Date.now();
  await page.goto("/auth");
  await page.getByTestId("submit").click();
  await page.waitForURL("/dashboard");
  expect(Date.now() - start).toBeLessThan(2000);
});
```

## Load tests

- Ferramenta: k6 ou Artillery.
- Cobrir: endpoint de leitura mais quente, endpoint de escrita crítico, login.
- Critério: p95 < SLO, erro < 0.1%.
- Rodar fora do CI de PR (nightly ou pré-release).

## Resiliência

- **Backup/restore drill**: restaurar backup recente em ambiente isolado e validar checklist (rows count, integridade, RLS ativo).
- **Retry/DLQ**: job que falha 3x vai para dead-letter; teste simula falha e checa fila.
- **Falhas externas**: mockar 500/timeout do provedor externo e validar fallback/circuit breaker.
- **Recuperação parcial**: transação que falha no meio não deixa estado inconsistente.

## PWA / Offline / Realtime

- Simular `context.setOffline(true)` e validar fila offline + retry ao voltar.
- Realtime: 2 abas, ação em A aparece em B sem duplicação.
- Service worker: novo deploy mostra prompt de update.
