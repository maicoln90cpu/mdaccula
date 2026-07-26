# Plano — Refatoração para &lt;600 linhas por arquivo

## Ondas antigas (&lt;1000 linhas) — ✅ TODAS CONCLUÍDAS

| Onda | Arquivo | Antes → Depois | Status |
|------|---------|----------------|--------|
| 1 | EmailTemplateEditor.tsx | 2243 → 909 | ✅ |
| 2 | EmailConfig.tsx | 1901 → 1123 | ✅ |
| 3 | EventForm.tsx | 1602 → 816 | ✅ |
| 4 | EgressMonitor.tsx | 1272 → 215 | ✅ |
| 5 | _shared/emailBlocks.ts | 1243 → 32 | ✅ |
| 6 | generate-blog-post-v2/index.ts | 1220 → 737 | ✅ |
| 7 | MediaSettings.tsx | 1168 → 317 | ✅ |
| 8 | LinksManager.tsx | 1060 → 716 | ✅ |
| Bônus | AIContent2.tsx | 919 → 445 | ✅ |

---

## Nova meta: **&lt;600 linhas por arquivo**

Regras (iguais às ondas anteriores):
- **1 arquivo por onda**, no máximo 2 PRs cada.
- Zero mudança de comportamento — só mover código e reimportar.
- Checklist obrigatório: `tsgo --noEmit` + `eslint` + `vitest run` + validação manual no `localhost:8080`.
- Se for Edge Function: rodar `scripts/bundle-edge-functions.mjs` e conferir bundle.
- Excluídos: `src/integrations/supabase/types.ts` (auto-gerado), `src/components/ui/sidebar.tsx` (shadcn intocado).

### Ordem sugerida (mais crítico → menos crítico)

```text
Onda  9  EmailConfig.tsx                             1123 → 818 (PR-A ✅) → 465 (PR-B ✅)
Onda 10  BlockPropsPanel.tsx                         1060 → 38 (✅ dispatcher; 5 sub-painéis 158-323 linhas)

Onda 11  RedirectsManager.tsx                         911 → 365 (✅; +5 subcomponentes 62-238 linhas em pages/admin/redirectsManager/)
Onda 12  EmailTemplateEditor.tsx                      903 → 462 (✅; +5 módulos em emailTemplateEditor/: blockDefaults 145, typeFilter 46, EditorHeader 225, BlockListPanel 125, PreviewPanel 85)
Onda 13  EmailEventsTab.tsx                           867 → 161 (✅; +6 módulos em emailEventsTab/: helpers 112, useEmailEventsData 52, useEventActions 195, HeaderFilters 125, EventRow 231, CampaignHistoryRow 140)
Onda 14  EventDetail.tsx                              854 → 448 (✅; +8 módulos em components/eventDetail/: types 38, TicketCtaButton 43, HeroImage 37, TicketCard 71, EventDetailsCard 60, ScheduleOrLineup 115, RelatedBlogPostCard 45, RelatedEventsCard 63)
Onda 15  LinksAnalytics.tsx                           849 → <600
Onda 16  EventForm.tsx                                816 → 413 (✅; +useEventFormSubmit.tsx 476 em eventForm/)
Onda 17  Eventos.tsx                                  802 → 323 (✅; +4 módulos em components/eventos/: eventosHelpers 73, FiltersSection 201, CalendarSection 184, EventListCard 135)
Onda 18  AutomationsTab.tsx                           793 → 224 (✅ feita antecipada como "Onda 11"; + AutomationCard 296, SendOnCronToggle 25)
Onda 19  TemplatesPanel.tsx (ai-content)              771 → 292 (✅; +3 módulos em templatesPanel/: types 53, TemplatesTable 145, TemplateFormDialog 255, TemplatePreviewDialog 109)
Onda 20  generate-multi-event-article/index.ts       762 → 454 (✅; +prompts.ts 242 em _shared/generateMultiEventArticle/; reuso de http.ts, egress.ts e imageStyles.ts do generateBlogPostV2)
Onda 21  EventsManager.tsx                            755 → <600
Onda 22  generate-blog-post-v2/index.ts               737 → 527 (✅; +3 módulos em _shared/generateBlogPostV2/: dateHelpers 44, promptBuilder 174, savePost 116)
Onda 23  _shared/emailBlocks/renderBlock.ts           735 → 27 (✅ dispatcher; +4 módulos em renderBlock/: style 20, basic 178, interactive 271, digest 312)
Onda 24  LinksManager.tsx                             716 → <600
Onda 25  Podcast.tsx                                  711 → <600
Onda 26  emailTemplates/blocks.ts                     689 → <600
Onda 27  PodcastManager.tsx                           686 → <600
Onda 28  BlogManager.tsx                              659 → <600
Onda 29  weekly-digest-draft/index.ts                 654 → 416 (✅; +2 módulos em _shared/weeklyDigestDraft/: legacyHtml 158, buildEventPayload 139)
Onda 30  RecurringEventsManager.tsx                   646 → 274 (✅; +4 módulos em recurringEventsManager/: types 30, ScheduleConfigCard 94, RecurringConfigCard 80, EditConfigDialog 246)
Onda 31  Blog.tsx                                     645 → <600
Onda 32  CustomLinkForm.tsx                           624 → <600
Onda 33  AutoGenerationPanel.tsx                      620 → <600
Onda 34  EventTemplates.tsx                           602 → <600
```

Total: **26 arquivos** ainda acima da nova meta.

### Estratégia por tipo de arquivo

- **Páginas admin (EmailConfig, RedirectsManager, LinksAnalytics, etc.)** → extrair abas/cards para pasta dedicada `pages/admin/&lt;pagina&gt;/`.
- **Editores complexos (BlockPropsPanel, EmailTemplateEditor)** → separar por tipo de bloco (um arquivo por painel especializado).
- **Páginas públicas grandes (EventDetail, Eventos, Podcast, Blog)** → extrair seções visuais para `components/&lt;pagina&gt;/`.
- **Edge Functions (generate-multi-event-article, weekly-digest-draft)** → extrair helpers puros para `_shared/&lt;funcao&gt;/`, deixar só o handler HTTP no `index.ts`.
- **Renderers (renderBlock, blocks)** → dividir o switch por família de bloco (`renderBlockHero.ts`, `renderBlockWeekend.ts`, etc.).

---

## Pendências do plano original que ainda estão em aberto

1. **F2 (dispensado)** — Migrar `eventAnnouncement.ts` para `_shared` só se edge precisar. Ainda dispensado.
2. **F3 (opcional)** — ESLint rule proibindo novo `blocks.ts` em `src/lib/emailTemplates/`. Não implementado (guardião via teste de paridade cumpre a função).
3. **Onda 5 PR-B (pendente)** — Redeploy das 3 edges (`weekly-digest-draft`, `weekend-agenda-draft`, `blog-digest-draft`) após split de `_shared/emailBlocks/`. **Ação sugerida:** rodar `scripts/bundle-edge-functions.mjs` + deploy quando iniciar a Onda 23 ou 29.
4. **Onda 3 PR-B (opcional)** — Extrair schema Zod + submit do `EventForm` para `useEventForm.ts`. Vira parte da Onda 16.
5. **Onda 4 PR-B (opcional)** — Extrair fetchers do `EgressMonitor` para `useEgressData.ts`. Já abaixo da nova meta, dispensado.
6. **Onda 2 PR-C (opcional)** — Extrair `useEmailConfigState.ts` do `EmailConfig`. Vira a Onda 9.

### Pendências operacionais herdadas (não são de refatoração)

Levantadas em `PENDENCIAS.MD`:
- Checkpoint prerender SEO (~20/07/2026).
- Checkpoint redução de banda Bunny CDN (~02/08/2026).
- Checkpoint webhook Apify/Instagram (sem data).
- Revisão de funções `SECURITY DEFINER` públicas.
- Habilitar Leaked Password Protection no Supabase (1 clique manual).
- Restringir policies de `SELECT` dos buckets públicos (evitar `LIST`).

---

## Próximo passo

Aprovar **Onda 9 — EmailConfig.tsx (1123 → &lt;600)** para começar pela maior redução da nova meta.
