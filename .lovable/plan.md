# Fase B2 — Unificar renderizador de blocos (frontend ↔ edge)

## Antes vs Depois

**Antes:** dois arquivos gigantes em paralelo, mantidos manualmente sincronizados:
- `src/lib/emailTemplates/blocks.ts` (1509 linhas) — usado no preview do admin.
- `supabase/functions/_shared/emailBlocks.ts` (1100 linhas) — usado nas Edge Functions `weekly-digest-draft`, `weekend-agenda-draft`, `blog-digest-draft` que enviam à E-goi.
- Além disso, `blocksLimits.ts` e `emailBlocksLimits.ts` também são duplicados.
- Consequência: qualquer ajuste visual precisa ser feito 2×; divergências silenciosas geram e-mails diferentes do preview.

**Depois:** uma única fonte de verdade para tipos + renderer, importada dos dois lados. Zero duplicação de HTML/lógica. O preview renderiza exatamente o que a edge envia.

## Estratégia técnica

O obstáculo é ambiental: frontend (Vite/TS) e edge (Deno) têm regras de import diferentes. Solução escolhida (mais simples e sem tooling extra):

1. **Fonte canônica em `supabase/functions/_shared/`** — Deno já importa nativamente; Vite passa a importar via alias `@shared` apontando para `supabase/functions/_shared`.
2. Imports com extensão `.ts` explícita — Vite aceita, Deno exige. Isso mantém o mesmo caminho para os dois lados.
3. Nenhum símbolo específico de Deno/Vite no arquivo compartilhado (é 100% string/template puro).

## Etapas (deploy em fases seguras)

### Etapa 1 — Consolidar `blocksLimits`
- Manter `supabase/functions/_shared/emailBlocksLimits.ts` como canônico.
- Deletar `src/lib/emailTemplates/blocksLimits.ts`.
- Atualizar todos os imports do frontend para `@shared/emailBlocksLimits.ts`.
- Adicionar alias `@shared` no `vite.config.ts` e `tsconfig`.

### Etapa 2 — Unificar `blocks.ts`
- Escolher a versão **frontend** como base (mais completa, 1509 vs 1100 linhas — inclui presets e helpers do editor).
- Copiar para `supabase/functions/_shared/emailBlocks.ts` **apenas as partes puras**: tipos + `renderBlockedTemplate` + `computePreheader`.
- Manter os helpers de editor (presets, factories UI) **apenas em `src/`**, num novo arquivo `src/lib/emailTemplates/blocksEditor.ts` — não são usados pela edge.
- `src/lib/emailTemplates/blocks.ts` passa a ser um re-export fino: `export * from "@shared/emailBlocks.ts"` + reexporta os editors.

### Etapa 3 — Migrar edge functions
- `weekly-digest-draft`, `weekend-agenda-draft`, `blog-digest-draft` já importam de `../_shared/emailBlocks.ts` — nenhuma mudança de path.
- Verificar que o HTML gerado é byte-idêntico ao anterior (snapshot antes/depois).

### Etapa 4 — Teste de contrato
- Existe `supabase/functions/_shared/emailBlocks_test.ts`. Ampliar para gerar um snapshot HTML de um template completo.
- Novo teste frontend `src/__tests__/lib/emailBlocks.snapshot.test.ts` chama o **mesmo** renderer com os **mesmos** dados e compara — se divergirem, o teste falha.

## Vantagens

- Fonte única → nunca mais preview ≠ envio real.
- Redução líquida de ~1000 linhas duplicadas.
- Testes garantem que refactors futuros não regridam.
- Deploy em etapas: cada uma pode ser validada isoladamente.

## Desvantagens / riscos

- Mexe em código quente que dispara e-mails reais → risco alto se HTML mudar por acidente.
- Alias `@shared` novo pode confundir se não documentado.
- Um único bug afeta os 3 fluxos de envio ao mesmo tempo (antes o "isolamento por duplicação" mascarava problemas).

**Mitigação:** cada etapa vai com snapshot HTML comparando antes/depois; nenhum deploy sem esse diff conferido.

## Checklist manual de validação (ao final)

- [ ] `/admin` → E-mail → Configuração: preview do template renderiza igual ao anterior.
- [ ] `/admin` → E-mail → Automações: "Enviar teste" chega no inbox com o HTML esperado.
- [ ] Edge logs de `weekly-digest-draft`, `weekend-agenda-draft`, `blog-digest-draft` sem erros de import.
- [ ] Snapshot test passa (`bunx vitest run emailBlocks.snapshot`).
- [ ] `tsgo --noEmit` sem erros.

## Pendências / futuro

- Depois de unificar, mover `computePreheader` para chamada única (hoje é replicada em 3 edges).
- Considerar mover `eventAnnouncement.ts` também para `_shared` se algum dia a edge precisar dele.

## Prevenção de regressão

- Snapshot test compartilhado (mesmo fixture, dois runners) — falha se frontend e edge divergirem.
- Comentário no topo de `_shared/emailBlocks.ts`: "fonte única; NÃO duplicar em `src/`".
- ESLint rule opcional (futuro): proibir novo arquivo `blocks.ts` em `src/lib/emailTemplates/`.

## Recomendação de execução

Executar etapa por etapa, com sua aprovação entre cada uma:
1. Etapa 1 (limits) — baixo risco, aquece o alias.
2. Etapa 2 (blocks) — coração da mudança, com snapshot antes/depois.
3. Etapa 3 (edges) — só validação, imports não mudam.
4. Etapa 4 (testes) — trava contra regressão.

Confirma seguir por essa ordem, começando pela **Etapa 1**?
