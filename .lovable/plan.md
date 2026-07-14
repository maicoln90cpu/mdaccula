# Alinhar Vite ↔ Vitest e fechar vulnerabilidades

## Contexto (antes)
- `vite: ^5.4.19` (raiz) + `vitest: ^4.0.16` (que exige vite `^6 || ^7`)
- npm resolve com **duas cópias de vite** instaladas simultaneamente (v5 na raiz, v7 aninhada dentro do vitest) → warnings ERESOLVE.
- 4 vulnerabilidades abertas em `esbuild`/`vitest` (2 críticas, 1 alta, 1 moderada), incluindo GHSA-5xrq-8626-4rwp (arbitrary file read via UI server do vitest).
- Peers atuais já compatíveis com Vite 6/7:
  - `@vitejs/plugin-react ^5.1.2` → aceita Vite 5/6/7
  - `@vitejs/plugin-react-swc ^3.11.0` → aceita Vite 5/6/7
  - `lovable-tagger ^1.1.9` → aceita Vite 5+

## Depois (objetivo)
- Uma única versão de vite instalada (v7), alinhada com o que vitest 4 já usa internamente.
- `npm audit` sem vulnerabilidades high/critical.
- Build e testes passando.

## Caminho escolhido: subir Vite para v7
Motivo: vitest 4 já **exige** vite 6/7 internamente. Descer vitest para 3.x seria retroceder e ainda deixaria vulnerabilidades sem patch. Todos os plugins do projeto já suportam vite 7.

## Passos de execução (em build mode)

1. **Editar `package.json`**
   - `"vite": "^5.4.19"` → `"vite": "^7.0.0"`
   - Manter `@vitejs/plugin-react`, `@vitejs/plugin-react-swc`, `lovable-tagger`, `vitest` e `@vitest/coverage-v8` nas versões atuais.

2. **Reinstalar dependências**
   - `rm -rf node_modules package-lock.json && npm install`
   - Confirmar que só há **1** entrada de `vite` em `npm ls vite`.

3. **Aplicar patches de segurança**
   - `npm audit fix` (sem `--force` primeiro — evita downgrades surpresa).
   - Se persistirem críticas, `npm audit fix --force` e revalidar versões.
   - Rodar `npm audit --audit-level=high` e confirmar 0 findings high/critical.

4. **Validação (obrigatória antes de fechar)**
   - `npx tsc --noEmit` → sem erros de tipo.
   - `npm run build` → build de produção OK.
   - `npm test` → suíte Vitest verde.
   - Abrir `npm run dev` mentalmente via smoke: garantir que `vite.config.ts` (não muda) segue válido em Vite 7.

5. **Registro**
   - `package.json` e `package-lock.json` ficam atualizados no working tree.
   - Não mexer em código de aplicação. Não tocar `vite.config.ts` a menos que a validação acuse breaking change (Vite 7 mantém a API do `defineConfig` usada aqui).

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Vite 7 quebrar `vite.config.ts` (manualChunks, terser, lightningcss) | API usada é estável entre 5→7. Se falhar, ajuste pontual no config; sem impacto em runtime da app. |
| `lovable-tagger` recusar Vite 7 em peer | Se aparecer ERESOLVE, cair para Vite 6 (`^6.0.0`) que também satisfaz vitest 4 e resolve o conflito. |
| `npm audit fix --force` subir vitest para major novo | Só usar `--force` se `npm audit fix` normal deixar críticas. Revalidar suíte imediatamente. |
| Testes quebrarem por mudança em `@vitest/coverage-v8` | Versão já está em 4.0.16, alinhada com vitest 4. Sem mudança prevista. |

## Protocolo de resposta (o que reporto ao final)
- Antes vs depois de versões e nº de vulnerabilidades.
- Melhorias: 1 só vite instalado, CVEs fechadas, alinhamento oficial vite↔vitest.
- Vantagens: menos warnings, segurança em dia. Desvantagens: Vite 7 é recente — monitorar por 1-2 dias.
- Checklist manual: rodar `/`, `/eventos`, `/admin` no preview após deploy e confirmar sem regressão visual.
- Pendências: nenhuma prevista; se `--force` for necessário, reportar antes de aplicar.
- Prevenção de regressão: manter job `security` no CI (`.github/workflows/ci.yml` já roda `npm audit --audit-level=high`) — considerar remover `continue-on-error: true` desse step num PR futuro para travar regressões de vulnerabilidade.

## Aprovação necessária
Confirma que posso executar em build mode? Se preferir a rota conservadora (Vite 6 em vez de 7), me avise antes.
