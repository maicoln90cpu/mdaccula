# Plano consolidado — Fase B2 completa + pendências

Aprovado pelo usuário. Substitui planos anteriores. Objetivo: unificar frontend↔edge sem perder features, e liquidar tudo que ficou aberto nas Fases A–E.

---

## Parte 1 — Fase B2: unificação real do renderer (bloco a bloco)

Fonte única em `supabase/functions/_shared/emailBlocks.ts`. Frontend passa a reexportar.
Regra: para cada divergência, escolher o melhor lado (conforme auditoria de 13 itens). Nada é perdido.

### Etapa 2.1 — Tipagem unificada (EM ANDAMENTO)
Sem tocar em renderer. Só amplia tipos para conter união dos campos.
- Frontend `WeekendEventItem` (em `eventAnnouncement.ts`): adicionar `ctaLabel?`, `ctas?: Array<{label,url,dayLabel?,timeLabel?}>`.
- Frontend `EventAnnouncementData`: adicionar `vipLink?`.
- Edge já tem todos esses campos; garantir paridade.
- Validação: `tsgo --noEmit` limpo; testes passam.

### Etapa 2.2 — Utilitários "frontend-vence" portados p/ edge
1. `proxyForEmail` (hero_image, image_with_link) — proxy Bunny/Supabase.
2. Placeholder de flyer quando URL ausente.
3. `cta_button` bulletproof VML/Outlook.
4. `divider` `<table bgcolor>` (compat Outlook).
5. `countdown medium` no formato dias/horas.
6. Bloco `preview: true` com placeholders informativos.
Validação: snapshot HTML edge antes/depois byte-idêntico para payloads reais.

### Etapa 2.3 — Features "edge-vence" no canônico
1. `weekend_grid`: `heroEventId`, `ev.ctas[]`, header opcional.
2. `weekly_hero`: `ctaLabel`/`ctas[]`.
3. `computePreheader` (edge) canônica, corte em 150.
4. `static_map` usando `ctx.projectId`.
5. `renderBlockedTemplateText` (multipart text) exportado.
6. `expandGlobalRefs`: dois modos via `options.globalsCatalog?`.
Validação: snapshot bilateral verde.

### Etapa 2.4 — Frontend vira reexport fino
- `src/lib/emailTemplates/blocks.ts` → `export * from "@shared/emailBlocks.ts"` + reexports editor.
- Helpers só-editor (presets, `BLOCK_LABELS`, `TEMPLATE_PRESETS`, factories) migrados p/ `src/lib/emailTemplates/blocksEditor.ts`.
- Validação: preview `/admin → E-mail → Configuração` idêntico.

### Etapa 2.5 — Snapshot bilateral de contrato
- Ampliar `_shared/emailBlocks_test.ts` (3 snapshots: preview off/on, com globals).
- Criar `src/__tests__/lib/emailBlocks.snapshot.test.ts` que importa via `@shared` e compara com fixture — trava duplicação futura.
- Comentário-guardião no topo de `_shared/emailBlocks.ts`.

---

## Parte 2 — Pendências das fases anteriores

### Fase A — Higiene
- **A2 (residual):** varrer `console.*` restantes nos 7 arquivos originais + novos.
- **A3:** ✅ já coberto por `useAuth-signout-cache.test.tsx`.

### Fase B — Deduplicação
- **B1 (limits):** ✅ concluída.
- **B2 (renderer):** Parte 1 acima.

### Fase C — Slim-down `EmailConfig.tsx`
- ✅ concluída. Rever se `useEmailAutomation` cobre 100% dos handlers.

### Fase D — Race conditions (AbortController)
- Aplicar em: `pages/Search.tsx`, `admin/EventsManager.tsx`, `admin/LinksManager.tsx`, `admin/BlogManager.tsx`.
- Filtrar `AbortError` do logger.
- Teste: buscar rápido → só o último resolve.

### Fase E — Slim-down grandes
- `EventForm.tsx`: extrair seções (Datas, Lineup, Mídia, Preços, Local).
- `LinksManager.tsx`: mesma técnica.
- Executar só após D estabilizada.

### Extras (novos da auditoria)
- **F1.** `computePreheader` chamada única (consequência natural da 2.3).
- **F2.** `eventAnnouncement.ts` → `_shared` só se edge precisar (futuro).
- **F3.** ESLint rule proibindo novo `blocks.ts` em `src/lib/emailTemplates/` (blindagem opcional).

---

## Ordem de execução

```text
2.1  tipagem unificada         (baixo risco) ← ATUAL
2.2  utilitários FE→edge       (médio, snapshot)
2.3  features edge→canônico    (médio, snapshot)
2.4  frontend reexport         (baixo se 2.2/2.3 ok)
2.5  snapshot bilateral        (trava regressão)
── pausa: validação de envios reais ──
D    AbortController (4 telas)
A2   varredura logger residual
E    slim-down EventForm/LinksManager
F3   eslint guardião (opcional)
```

## Prevenção de regressão
- Snapshot bilateral (2.5).
- Comentário-guardião em `_shared/emailBlocks.ts`.
- (Opcional F3) ESLint rule.

## Checklist manual (fim da Parte 1)
- [ ] Preview `/admin → E-mail → Configuração` idêntico.
- [ ] "Enviar teste" com HTML esperado (imagem, CTA, countdown).
- [ ] Edge logs limpos nas 3 funções.
- [ ] `bunx vitest run` verde.
- [ ] `tsgo --noEmit` limpo.
