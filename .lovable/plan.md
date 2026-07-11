# Plano — E-mails MDAccula (7 itens)

Cada item é uma etapa independente. Vou executar em fases seguras — você aprova o plano; depois eu implemento fase a fase.

---

## Fase 1 — Correções de bugs (itens 1, 6, 7)

### Item 1 — Bloco global não renderiza no preview ("indisponível")

**Diagnóstico (o que investiguei):**
- `EmailTemplateEditor` e `GlobalBlocksLibrary` chamam cada um seu próprio `useEmailGlobalBlocks()`, criando **dois caches independentes**.
- Quando você salva um novo global pela biblioteca, só o cache da biblioteca é recarregado; o cache do editor continua sem enxergar o novo `global_id` → o `expandGlobalRefs` cai no fallback "indisponível".
- Também há risco de o bloco global original ter sido salvo já com `hidden: true` (herdado do editor), fazendo com que mesmo depois de resolvido ele renderize vazio.

**O que vou mudar:**
- Criar um contexto `EmailGlobalBlocksProvider` (uma única fonte) e trocar as duas chamadas por `useEmailGlobalBlocksContext()`. Assim, salvar/editar/deletar recarrega o cache que o preview usa.
- No `saveAsGlobal`, remover `hidden` do bloco antes de salvar (bloco global nunca deve ser "oculto" na origem — a visibilidade é da referência no template).
- No fallback "indisponível", mostrar também o `global_id` no editor para diagnóstico rápido.

### Item 6 — Blocos do template (ex.: redes sociais) não aparecem no preview

**Diagnóstico:** dois cenários possíveis, vou tratar os dois:
1. `social_icons` filtra por `n.enabled` — se todas as redes estiverem desabilitadas ou sem URL fora do modo preview, some. No preview isso já é tolerado, mas outros blocos (lineup, static_map, article_summary) só renderizam se os dados existirem no evento.
2. O bloco pode estar com `hidden: true` sem indicação visual clara.

**O que vou mudar:**
- Auditar cada renderer de bloco e, quando ele retornar vazio em modo `preview`, exibir um **stub visível** ("[Bloco `Redes sociais` sem dados — preencha em Configuração]") em vez de sumir silenciosamente. Só afeta preview; no envio real continua omitindo.
- Adicionar badge visível "OCULTO" na lista de blocos à esquerda quando `hidden=true` (hoje só o ícone `EyeOff` — fácil de não perceber).

### Item 7 — Alterações no bloco não persistem

**Diagnóstico:** o editor mantém `localBlocks` até você clicar em "Salvar template". Se você troca de template ou navega de aba antes de salvar, as alterações são perdidas silenciosamente. Também não há aviso de "alterações não salvas".

**O que vou mudar:**
- Adicionar detecção de "dirty" (alterou algo local) e:
  - Badge "• Não salvo" ao lado do nome do template.
  - Confirmação ao trocar de template/aba/rota com `beforeunload` + guarda no `Select`.
  - Botão "Salvar" fica destacado (variante primária) quando dirty.
- Investigar via replay se realtime está sobrescrevendo `localBlocks` (o `useAdminRealtime` pode invalidar). Se sim, ignorar update de `email_templates` enquanto `localBlocks !== null`.

---

## Fase 2 — Item 5: Busca no Histórico inclui "Eventos sem rascunho"

Hoje o campo `historySearch` filtra só a lista de baixo ("Histórico por evento"). Vou:
- Aplicar o mesmo filtro na lista "Eventos sem rascunho ({pending.length})" (por título, cidade, data).
- Trocar o placeholder para "Buscar em rascunhos e histórico...".
- Contador dinâmico: "Eventos sem rascunho (X de Y)" quando houver filtro ativo.

---

## Fase 3 — Item 2: Novo fluxo Editor + Preview (2 passos)

Reorganizar a aba "Editor + Preview" da `EmailConfig`:

```text
┌─ Aba Editor + Preview ─────────────────────────┐
│ 1º Tipo de template:                           │
│   [ Evento ] [ Virada ] [ Agenda FDS ]         │
│   [ Digest ] [ Cortesia ] [ Custom ]           │
│                                                 │
│ 2º Template daquele tipo:                      │
│   Select mostrando só os do tipo escolhido     │
│                                                 │
│ [ ...editor de blocos + preview ao vivo... ]   │
└─────────────────────────────────────────────────┘
```

- Adicionar prop `type` em `EmailTemplateEditor` e filtrar `templates` por `t.type === selectedType`.
- Persistir `selectedType` em `localStorage` (`mdaccula_email_editor_type`) para lembrar entre sessões.
- Mostrar contagem por tipo nos chips: `Evento (7)`, `Virada (2)`, etc.
- Se o tipo escolhido não tiver template, mostrar CTA "Criar primeiro template de {tipo}" já pré-configurado.

---

## Fase 4 — Item 3: Template de cortesia

Criar um novo preset `courtesy` em `TEMPLATE_PRESETS` + novo tipo `"courtesy"` em `email_templates.type`.

Blocos padrão (conforme sua escolha):
1. `header` (logo)
2. `text` — saudação: "Olá **{{guest_name}}**, você ganhou uma cortesia para:" (variáveis novas: `guest_name`, `courtesy_code`).
3. `title` (nome do evento)
4. `event_meta` (data · hora · local)
5. `static_map` (usa lat/lng do evento — já ligado ao Google Maps)
6. `cta_button` — "Retirar cortesia" com `url_field: "courtesy_link"` (novo campo no evento).
7. `divider`
8. `social_icons`
9. `footer` (com descadastro)

Migração leve:
- Adicionar coluna `courtesy_link_template` em `email_template_settings` (opcional) para gerar link no envio.
- Nada em `events` — o link é passado no dispatch pelo painel de cortesias (fora do escopo desta fase; só o template fica pronto).

---

## Fase 5 — Item 4: Revisão dos templates antigos (só proposta, você aprova)

Depois das fases 1–4, vou abrir cada template antigo e te mandar um relatório assim (sem tocar em nada):

```text
Template "Evento novo (padrão)"
  Recomendo adicionar:
    + static_map (agora que Google Maps está ligado)
    + ticker (últimas horas) — opcional
  Recomendo trocar:
    ~ footer local → bloco global "Rodapé padrão" (única fonte)
  Riscos: nenhum, static_map some silencioso se sem lat/lng.

Template "Virada de lote"
  ...
```

Você aprova bloco a bloco, aí eu aplico.

---

# Detalhes técnicos (referência)

**Arquivos que vou tocar:**
- `src/hooks/useEmailGlobalBlocks.ts` → virar contexto.
- `src/lib/emailTemplates/blocks.ts` → preset `courtesy`, stubs de preview, tipo `courtesy`.
- `src/components/admin/EmailTemplateEditor.tsx` → prop `type`, badge "não salvo", guard de troca, badge "oculto".
- `src/components/admin/GlobalBlocksLibrary.tsx` → usar contexto, limpar `hidden` no save.
- `src/pages/admin/EmailConfig.tsx` → seletor por tipo, filtro do histórico incluindo pendentes.
- Provider novo: `src/contexts/EmailGlobalBlocksContext.tsx`.

**Testes/proteção contra regressão:**
- Teste unitário: `expandGlobalRefs` remove `hidden` do bloco global resolvido.
- Teste unitário: `renderBlock` em modo preview retorna stub visível para blocos sem dados obrigatórios.
- Teste de arquitetura: apenas UM `useEmailGlobalBlocks` no bundle (grep no build).
- Teste unitário: preset `courtesy` contém `header, text, title, event_meta, static_map, cta_button, social_icons, footer`.

**Sem risco para envios reais em produção:**
- Fase 1 só afeta preview + editor.
- Fase 2 é filtro de UI.
- Fase 3 é reorganização visual.
- Fase 4 é template novo, não afeta os existentes.
- Fase 5 é só relatório.

---

# Ordem de execução sugerida

1. Fase 1 (bugs) — mais urgente, sem risco.
2. Fase 2 (busca histórico) — 10 min.
3. Fase 3 (novo fluxo editor) — melhoria de UX.
4. Fase 4 (template cortesia) — feature nova.
5. Fase 5 (relatório templates antigos) — só depois de tudo acima estável.

Se preferir outra ordem, é só dizer. Aprovando, começo pela Fase 1.
