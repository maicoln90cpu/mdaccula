## Objetivo
Três melhorias focadas na experiência do editor de e-mails e finalizar o template de Cortesia.

---

### Etapa 1 — Rótulo compacto de blocos globais na lista de blocos do template

**Como está hoje**
Na lista "Blocos do E-mail", um bloco global aparece como `"Bloco global (biblioteca)"`. O texto é longo, é truncado (`Bloco global (b...`) e não dá para saber qual global é sem clicar.

**Como fica**
- Bloco global passa a exibir: um ícone pequeno de "biblioteca" (`Library`) + o **nome do bloco global salvo** (usando `_cached_name` já existente, ou o nome resolvido pelo cache do contexto `useEmailGlobalBlocks`).
- Fallback quando o nome não foi resolvido ainda: "Bloco global".
- Alteração local em `SortableRow` dentro de `src/components/admin/EmailTemplateEditor.tsx`: quando `block.kind === "global_ref"`, renderiza `<Library icon/> + nome` em vez de `BLOCK_LABELS["global_ref"]`.

**Vantagens** Leitura imediata; distingue vários globais no mesmo template.
**Desvantagens** Nenhuma funcional. Só visual.

---

### Etapa 2 — Cartão "Biblioteca de blocos globais" mais compacto

**Como está hoje**
No card da biblioteca (lateral), cada global ocupa 2 linhas: nome + linha secundária com "Bloco global (biblioteca) · descrição". O rótulo "Bloco global (biblioteca)" é redundante (o card já se chama "Biblioteca de blocos globais").

**Como fica** (`src/components/admin/GlobalBlocksLibrary.tsx`)
- Substituir o texto do tipo de bloco por um **ícone pequeno** representando o tipo interno (ex.: `Image` para hero, `Type` para title, `Square` para cta, `Library` genérico) + a descrição.
- Título fica em 1 linha, sublinha só com a descrição (se houver).
- Botões "+ / ✎ / 🗑" continuam iguais.

**Vantagens** Mais globais visíveis sem rolagem; leitura mais limpa.
**Desvantagens** Perde-se o texto do tipo, mas o ícone + o nome do próprio bloco global já bastam.

---

### Etapa 3 — Propriedades do `global_ref` no painel direito

**Como está hoje**
Ao clicar num `global_ref` no editor, o painel de propriedades diz "Este bloco não tem propriedades editáveis". Não dá para editar nada.

**Como fica** (`src/components/admin/EmailTemplateEditor.tsx`)
Painel passa a mostrar, para `global_ref`:
1. **Cabeçalho informativo**: ícone `Library` + nome do global + descrição + categoria (readonly, vindos do `globalsMap`).
2. **Aviso didático**: "Este é um bloco compartilhado. Alterações aqui refletem em TODOS os templates que o usam."
3. **Botão "Editar bloco global"** → abre um `Dialog` que renderiza o **mesmo painel de propriedades** que o bloco interno usaria (ex.: se o global for um `footer`, mostra os controles de `footer`).
4. Ao salvar no dialog: chama `updateGlobal(id, { block: novoBlock })` (o hook já existe; hoje aceita `Partial<Omit<GlobalBlock, "id">>` — só precisa incluir `block` no update).
5. Botão secundário "Desfazer vínculo (converter em bloco local)": substitui o `global_ref` pelo bloco expandido no template atual — útil quando o usuário quer customizar só ali.

**Vantagens** Edição direta sem sair para outra tela; reforça a natureza compartilhada com o aviso; opção de desvincular preserva flexibilidade.
**Desvantagens** Ao salvar, todos os templates que usam o global mudam — o aviso mitiga; ainda assim precisa toast de confirmação com contagem de templates impactados (mostrar `"X templates usam este bloco"`).
**Pendência futura** Página dedicada "Blocos Globais" (já mencionada no roadmap) para gerenciar em massa.

---

### Etapa 4 — Criar template padrão de Cortesia

**Como está hoje**
Aba "Cortesia (0)" no editor mostra "Nenhum template de 'Cortesia' ainda. Use 'Novo' para criar." O preset `courtesy` **já existe** em `buildPresetBlocks("courtesy")` e em `TEMPLATE_PRESETS`. Falta apenas seed do template no banco.

**Como fica**
Migration Supabase inserindo **um** template com:
- `type = 'courtesy'`
- `name = 'Cortesia — oportunidade (padrão)'`
- `subject_template = '🎟️ Cortesia liberada — {{event_title}} (poucas vagas)'`
- `preheader_template = 'Cortesias limitadas para {{event_title}}. Garanta a sua antes que acabe.'`
- `blocks` = saída de `buildPresetBlocks('courtesy')` (já com copy de escassez: "poucas vagas", "chegue cedo", CTA "Garantir minha cortesia").
- `is_default = true` para esse tipo.

Como é genérico (não nominal), fica reutilizável em qualquer evento onde admin queira anunciar cortesias.

**Vantagens** Admin tem ponto de partida imediato; copy já vem alinhada com "sensação de oportunidade / escassez" que você pediu.
**Desvantagens** Se o preset em código evoluir depois, o template no banco não muda sozinho (é uma foto). Isso é o comportamento normal e esperado dos outros presets.

---

### Checklist manual (após implementação)

- [ ] Editor de template: bloco global agora mostra ícone + nome real (ex.: "🗂 Redes sociais GL").
- [ ] Card "Biblioteca de blocos globais": lista mais enxuta, sem "Bloco global (biblioteca)" repetido.
- [ ] Clicar em bloco global no editor: painel mostra info + botão "Editar bloco global" + botão "Desfazer vínculo".
- [ ] Editar via dialog: alteração aparece em outros templates que usam o mesmo global.
- [ ] "Desfazer vínculo": bloco vira local, edições posteriores só afetam este template.
- [ ] Aba "Cortesia" agora mostra "Cortesia (1)" com o template padrão listado.
- [ ] Preview do template Cortesia renderiza com copy de escassez.

### Prevenção de regressão

- Snapshot test: `buildPresetBlocks("courtesy")` continua contendo pelo menos 1 CTA + 1 eyebrow com termos de escassez ("cortesia", "poucas").
- Teste de componente (`EmailTemplateEditor`) para o rótulo do `global_ref` (mostra nome do global, não o label genérico).
- Teste do painel de propriedades: `global_ref` selecionado renderiza botão "Editar bloco global".

### Detalhes técnicos

- Alteração em `SortableRow`: usa `useEmailGlobalBlocks().globalsMap.get(block.global_id)?.name ?? block._cached_name ?? "Bloco global"`.
- Update do bloco interno de um global usa `updateGlobal(id, { block: patched })` — já suportado pela assinatura do hook.
- "Desfazer vínculo" chama `expandGlobalRefs` de forma local (só neste template) ou simplesmente substitui a entrada no array de blocks pelo `globalsMap.get(id).block` com novo `id`.
- Migration usa `INSERT INTO public.email_templates (...) SELECT ...` para gerar `id` e `created_at` automáticos; roda uma vez, idempotente com `WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE type='courtesy')`.

### Ordem sugerida de deploy (fases seguras)

1. **Fase A** (visual, sem risco): Etapa 1 + 2 juntas.
2. **Fase B** (funcional, risco baixo/médio): Etapa 3 — sozinha, para validar edição de globais sem quebrar outros templates.
3. **Fase C** (dados): Etapa 4 — migration do template padrão de Cortesia.
