
# Plano — 10 itens em 3 fases

Todos os itens de baixo risco, agrupados por área. Nada muda em banco de dados.

---

## FASE 1 — /links e /admin/links-manager 100% sincronizados

### Item 1 — Admin usar o mesmo helper de ordenação
**Antes:** `src/pages/admin/LinksManager.tsx` faz `.from("link_groups")...order("display_order")` direto e usa esse resultado. Por isso mostra MAIO/26 antes de SETEMBRO/26 sem obedecer a regra cronológica.

**Depois:**
- Importar `sortLinkGroups` de `@/hooks/useLinks` e aplicar após o fetch.
- Aplicar também `processLinks` (mesmo helper de `/links`) para que os cartões dentro de cada grupo respeitem override_date/end_date, exatamente como no site público. Em modo admin, `processLinks` continua filtrando `enabled=true`; para o admin queremos ver os desabilitados também → adicionar flag opcional `processLinks(links, settings, { includeDisabled: true })` que pula o `.filter`.
- Refactor: extrair as duas funções (`processLinks` + `sortLinkGroups`) para `src/lib/linksOrdering.ts` (ou manter em `useLinks.ts` — só re-exportar), para que ambas as páginas importem do mesmo arquivo.

**Ganho:** alterar num lugar reflete nos dois. Fim da divergência.

### Item 2 — Nostalgia (10/07) nos templates FDS/digest
**Diagnóstico esperado:** o filtro de eventos dos templates `weekend-agenda-draft` e `weekly-digest-draft` provavelmente compara só `event.date`, ignorando `end_date`. Nostalgia tem `date=2026-07-09`, `end_date=2026-07-10` → filtro do dia 10 exclui.

**Ação:** ajustar a query/filter para incluir eventos onde `date <= rangeEnd AND coalesce(end_date, date) >= rangeStart` nas duas edge functions e no preview do admin. Reutilizar `isEventVisible` / lógica de `eventDateHelper` no lado servidor via helper compartilhado (copiar utilitário para `supabase/functions/_shared/`).

### Item 3 — DEDGE recorrente condensado em 1 card com múltiplas datas
**Antes:** templates "Agenda FDS — Cartaz digital" e "Digest semanal — Cartaz da semana" listam 1 card por data de DEDGE.

**Depois:** no builder desses dois templates, agrupar eventos que compartilham `recurring_event_config_id` (ou mesmo `title` + `venue`) em um único card com lista de datas (mesmo padrão já usado no "Timeline por dia").

Arquivos envolvidos: `supabase/functions/_shared/emailBlocks.ts` + os templates de cartaz. Investigar ponto exato durante execução.

---

## FASE 2 — Auditoria de conteúdo + Editor de Blocos

### Item 4 — Trocar "Cuiabá" por "São Paulo - SP"
Auditoria global via `rg -i "cuiab"` em `src/`, `supabase/functions/`, `public/`, `docs/`. Substituir por São Paulo/SP em: previews mock, textos de digest, subtítulos automáticos, seed data. Listar antes de trocar para o usuário confirmar caso apareça em algum lugar sensível.

### Item 5 — Contagem regressiva tamanho "médio"
No editor de blocos (`EmailTemplateEditor.tsx` ou equivalente), reduzir o tamanho "médio" ~30% (fonte/padding) para ficar entre o minimalista e o grande. Manter o grande intacto.

### Item 6 — Bloco "Flyer do evento" sem preview
Adicionar imagem placeholder genérica quando `event.image_url` está vazio no preview (usar `/placeholder.svg` ou asset dedicado). Só afeta o preview do editor, não a geração real.

### Item 7 — Ícone de olho (mostrar/ocultar) por bloco
Ao lado dos botões duplicar/excluir de cada bloco, adicionar toggle olho aberto/fechado (lucide `Eye`/`EyeOff`). Persiste em `block.hidden` (novo campo booleano no JSON do template). Preview e geração final respeitam a flag: bloco oculto é pulado no render.

---

## FASE 3 — Automações, Histórico e Pendências

### Item 8 — Opção "— Padrão (is_default) —" nos selects de template
Investigar de onde vem. Provavelmente é o registro em `email_templates` marcado com `is_default=true`. Se estiver duplicando o template real (que aparece nomeado logo abaixo), remover a opção genérica e deixar apenas os templates nomeados, marcando visualmente qual é o default (⭐ já existe).

### Item 9 — Busca por nome de evento na aba Histórico
Adicionar `<Input>` de busca no topo da seção "Histórico por evento" filtrando client-side pelo `event.title` (case-insensitive, sem acento).

### Item 10 — Levantamento de pendências das fases anteriores
Ler `PENDENCIAS.MD` + `.lovable/plan.md` e listar aqui, num último passo, o que ficou em aberto (SEO, egress, geração automática, etc.). Sem executar — só relatar para você decidir o próximo ciclo, junto com a integração Google Maps.

---

## Execução em 2 etapas (como você pediu)

**Etapa A — Itens 1, 2, 3, 4** (sincronia /links + admin, multi-dia, DEDGE, Cuiabá→SP)
Risco: baixo. Alteração de leitura/exibição. Validação manual: abrir /links e /admin/links-manager lado a lado → ordem idêntica. Nostalgia visível no dia 10/07 no preview dos 4 templates. Cards DEDGE consolidados. Nenhuma menção a Cuiabá restante.

**Etapa B — Itens 5, 6, 7, 8, 9, 10** (editor de blocos + automações + histórico + relatório)
Risco: baixo, mudanças isoladas no editor e nas abas. Validação manual: olho oculta bloco no preview e no envio; contagem regressiva média visualmente distinta da grande; busca no histórico filtra corretamente.

## Protocolo de resposta (por etapa)
Para cada etapa concluída informarei: antes vs depois, melhorias, vantagens/desvantagens, checklist manual, pendências, prevenção de regressão (testes/guards adicionados onde couber — ex: teste que garante `LinksManager` usa `sortLinkGroups`).

Confirma iniciar pela Etapa A?
