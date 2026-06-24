# Estratégia de Testes

## Pirâmide

```
        /\
       /E2\        ← poucos, só jornadas de alto valor
      /----\
     / INT  \      ← alguns, integração com DB/serviços reais
    /--------\
   /   UNIT   \    ← muitos, rápidos, isolados
  /------------\
```

## Cobertura por risco (não por porcentagem cega)

Para cada domínio do produto, classifique:

| Risco | Exemplos | Meta de cobertura |
|---|---|---|
| Crítico | Pagamento, auth, RLS, cálculo de preço/imposto | 90%+ linhas + E2E + contract |
| Alto | CRUD principal, regras de negócio | 80%+ linhas + integration |
| Médio | Telas internas, dashboards | 60%+ unit em utils/hooks |
| Baixo | Páginas estáticas, marketing | smoke E2E opcional |

A meta global é consequência, não objetivo.

## Anti-padrões a recusar

- "100% de cobertura" sem matriz de risco → falsa segurança.
- Testar getters/setters triviais só pra subir métrica.
- E2E para validar lógica que cabe em unit.
- Mock do próprio código sob teste.
- Snapshot gigante usado como única assertion.
- `it.skip` sem issue + dono + prazo.
- Re-run automático infinito mascarando flakiness.

## Fluxo quando chega bug de produção

1. Reproduzir o bug em teste **antes** de corrigir (red).
2. Corrigir até o teste passar (green).
3. Commitar teste + fix juntos.
4. Anotar em `docs/TESTING.md` na seção "Regressões cobertas".
