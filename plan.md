# Plano consolidado — Fase B2 + pendências (ARQUIVO / CONCLUÍDO)

> **Status geral: ✅ 100% CONCLUÍDO em 13/07/2026.**
> Este arquivo é mantido como registro histórico. Novas iniciativas devem
> ser adicionadas em `docs/ROADMAP.md` (Fase 3) e não aqui.

---

## Parte 1 — Fase B2: unificação real do renderer (bloco a bloco) — ✅

Fonte única em `supabase/functions/_shared/emailBlocks.ts`; frontend reexporta.

| Etapa | Descrição | Status |
|-------|-----------|--------|
| 2.1 | Tipagem unificada (`WeekendEventItem.ctas`, `vipLink`) | ✅ |
| 2.2 | Utilitários FE→edge (`proxyForEmail`, placeholder flyer, CTA VML/Outlook, divider bgcolor, countdown medium, blocos `preview:true`) | ✅ |
| 2.3 | Features edge→canônico (`weekend_grid` heroEventId+ctas, `weekly_hero` ctaLabel, `computePreheader` canônica, `static_map` ctx.projectId, `renderBlockedTemplateText`, `expandGlobalRefs` com `globalsCatalog`) | ✅ |
| 2.4 | Frontend virou reexport fino: `src/lib/emailTemplates/blocks.ts` → `export * from "@shared/emailBlocks.ts"` + `blocksEditor.ts` | ✅ |
| 2.5 | Snapshot bilateral (`src/__tests__/contracts/frontend-edge-render-parity.test.ts` + `_shared/emailBlocks_test.ts`) — trava duplicação futura | ✅ |

Prova viva:
- `src/__tests__/contracts/frontend-edge-render-parity.test.ts` compara
  referências de função e HTML byte-idêntico para 3 famílias de blocos.
- Comentário-guardião presente em `_shared/emailBlocks.ts`.

---

## Parte 2 — Pendências das fases anteriores — ✅

| Fase | Item | Status |
|------|------|--------|
| A2 | Varredura `console.*` residual | ✅ |
| A3 | Teste de cache de signout | ✅ (`useAuth-signout-cache.test.tsx`) |
| B1 | Deduplicação `blocksLimits` | ✅ |
| B2 | Unificação renderer (Parte 1) | ✅ |
| C | Slim-down `EmailConfig.tsx` + `useEmailAutomation` | ✅ |
| D | AbortController em Search / EventsManager / LinksManager / BlogManager + filtro `AbortError` no logger | ✅ |
| E | Slim-down `EventForm.tsx` e `LinksManager.tsx` (extração de seções) | ✅ |
| F1 | `computePreheader` chamada única (consequência de 2.3) | ✅ |
| F2 | `eventAnnouncement.ts` migrado para `_shared` só se necessário | ⏸ dispensado (edge não precisa hoje) |
| F3 | ESLint rule proibindo novo `blocks.ts` em `src/lib/emailTemplates/` | ⏸ opcional — não implementado (guardião via teste de paridade cumpre a função) |

---

## Parte 3 — Trabalhos adicionais concluídos após o plano original

Não estavam previstos aqui, mas foram feitos e ficam registrados para
histórico:

1. **Google Maps em domínio customizado (`mdaccula.com`)** ✅
   - Nova edge `public-maps-config` (fallback `GOOGLE_MAPS_BROWSER_KEY_CUSTOM` → managed).
   - `EventLocationMap.tsx` passa a resolver a chave via edge, com cache de módulo.
   - Chave customizada com referrer allowlist para `mdaccula.com`, `*.mdaccula.com`, `mdaccula.lovable.app`, `id-preview--*.lovable.app`.
   - Ativadas no Google Cloud: **Maps Embed API** (causa raiz do "REQUEST_DENIED"), Maps JavaScript API, Places API, Geocoding, Maps Static, Maps SDK Android.
2. **Roteamento de template por automação** ✅
   - Teste `edge-automation-template-routing.test.ts` atualizado para o helper `body.template_id = tplId` e 3 cards independentes.
   - Edges `weekly-digest-draft`, `weekend-agenda-draft`, `blog-digest-draft` validam bloco dinâmico obrigatório e prioridade override → configuração salva → default.
3. **Sitemap** ✅
   - Script `scripts/generate-sitemap.mjs` rodado; `public/sitemap.xml` atualizado.
4. **Conexão Google Maps Platform** ✅
   - Reconectada via workspace connector (Managed by Lovable) após troca de workspace.

---

## Prevenção de regressão em vigor

- Snapshot bilateral (`frontend-edge-render-parity.test.ts`) — falha se
  frontend voltar a ter renderer próprio.
- Comentário-guardião no topo de `_shared/emailBlocks.ts`.
- `edge-automation-template-routing.test.ts` — falha se algum card voltar a
  ignorar `template_id`.
- `EventLocationMap.tsx` documenta que a chave gerenciada só funciona em
  `*.lovable.app` e que Maps Embed API precisa estar ativa no projeto do
  Google Cloud.

## Checklist manual final — ✅ tudo conferido

- [x] Preview `/admin → E-mail → Configuração` idêntico ao envio real.
- [x] "Enviar teste" chega com HTML esperado.
- [x] Edge logs limpos nas 3 automações.
- [x] `bunx vitest run` verde.
- [x] `tsgo --noEmit` limpo.
- [x] Mapa carrega em `mdaccula.com` e no preview.

*Encerrado em 13/07/2026.*
