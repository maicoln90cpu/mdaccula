# CI & Qualidade dos Testes

## CI bloqueante

- PR não faz merge se: lint, `tsc --noEmit`, unit, integration, contract, E2E críticos ou build falharem.
- Feedback ideal < 10 minutos. Acima disso, paralelizar shards.

## Pipeline sugerido

```
1. install (cache)
2. lint + tsc --noEmit          (paralelo)
3. unit + integration           (paralelo, shard)
4. contract tests               (paralelo)
5. build
6. E2E críticos (headless)
7. axe nas rotas críticas
8. coverage report + ratchet check
9. smoke pós-deploy (se preview)
```

## Coverage ratchet

- Armazenar baseline em `coverage/baseline.json`.
- CI falha se cobertura cair > 0.5pp vs baseline.
- Quando subir, baseline atualiza automaticamente.

## Flake quarantine

- Teste flaky → mover para tag `@flaky` + abrir issue com dono + prazo (máx 7 dias).
- CI roda `@flaky` mas não bloqueia merge.
- Issue não resolvida no prazo → teste removido e bug escalado.

## Qualidade dos testes

Banir via lint/CI:
- `it.only`, `describe.only`
- `it.skip` sem comentário `// TODO(#issue): owner, due YYYY-MM-DD`
- `expect(true).toBe(true)`
- `waitForTimeout(`
- `console.log(` esquecido em teste
- `Math.random` sem seed em fixture

Use `scripts/check-test-health.mjs` no CI para varrer esses padrões.

## Smoke pós-deploy

Após cada deploy de produção, rodar 3–5 E2E mínimos contra a URL real (login, criar item, ver dashboard). Falha → rollback automático ou alerta P1.
