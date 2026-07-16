# Roadmap - MDAccula

## Visão Geral do Desenvolvimento

> Planejamento de fases, prioridades e cronograma para evolução da plataforma.

**Versão:** 1.5  
**Data:** 16/07/2026  
**Status Atual:** Fase 2 Concluída, Higiene técnica (B2 + pendências A–F) 100% concluída, Fase 3 Iniciando (UI/UX Premium concluído)

---

## 📋 Índice

1. [Resumo das Fases](#resumo-das-fases)
2. [Fase 1 - MVP](#fase-1---mvp)
3. [Fase 2 - Consolidação](#fase-2---consolidação)
4. [Fase 3 - Expansão](#fase-3---expansão)
5. [Fase 4 - Escala](#fase-4---escala)
6. [Backlog Futuro](#backlog-futuro)
7. [Documentos Relacionados](#documentos-relacionados)

---

## Resumo das Fases

```
┌─────────────────────────────────────────────────────────────────┐
│  Fase 1: MVP             │  Status: ✅ CONCLUÍDO               │
│  Dez/2025 - Jan/2026     │  Website + Admin + IA + Analytics   │
├─────────────────────────────────────────────────────────────────┤
│  Fase 2: Consolidação    │  Status: ✅ CONCLUÍDO               │
│  Jan-Fev/2026            │  Segurança + Automação + CDN + Docs │
├─────────────────────────────────────────────────────────────────┤
│  Fase 3: Expansão        │  Status: 🔄 INICIANDO               │
│  Mar-Abr/2026            │  Engajamento + WhatsApp + PWA       │
├─────────────────────────────────────────────────────────────────┤
│  Fase 4: Escala          │  Status: 💭 FUTURO                  │
│  Mai-Jun/2026            │  Mobile App + Multi-tenant + APIs   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fase 1 - MVP

**Período:** Dezembro 2025 - Janeiro 2026  
**Status:** ✅ CONCLUÍDO

### Features Entregues

- ✅ Homepage com hero e seções dinâmicas
- ✅ Lista de eventos com filtros (cidade, gênero, estado)
- ✅ Página de detalhe de evento
- ✅ Blog com busca full-text (tsvector)
- ✅ Página de links (Linktree-style)
- ✅ Quem Somos, Contato, SEO
- ✅ Autenticação com roles (RBAC)
- ✅ CRUD completo (eventos, posts, links, equipe)
- ✅ Sistema de IA (sugestões, geração, imagens, cron)
- ✅ Newsletter com A/B testing
- ✅ Analytics (views, cliques, shares, custos IA)

---

## Fase 2 - Consolidação

**Período:** Janeiro - Março 2026  
**Status:** ✅ CONCLUÍDO

### Automação 🤖

| Feature | Status | Data |
|---------|--------|------|
| Eventos recorrentes D.EDGE (pg_cron) | ✅ | 09/01/2026 |
| Carousel mobile de eventos | ✅ | 09/01/2026 |
| Prompt de imagem aprimorado (6 vars) | ✅ | 07/01/2026 |
| Cron semanal de limpeza (storage + logs) | ✅ | 11/02/2026 |
| Geração automática a cada 6h (otimizado) | ✅ | 18/02/2026 |

### Novas Features 🚀

| Feature | Status | Data |
|---------|--------|------|
| Programa de Podcast (MDAccula Radio) | ✅ | 23/01/2026 |
| Redirecionador de links com UTM (/r/:slug) | ✅ | 15/02/2026 |
| Importação de dados via CSV | ✅ | Fev/2026 |
| Artigo multi-datas para séries de eventos | ✅ | 15/01/2026 |
| Roteamento dual IA (OpenAI + Gemini) | ✅ | 14/02/2026 |
| Filtro de links fake na geração IA | ✅ | 04/02/2026 |
| Condicional Lista VIP/Social nos cards | ✅ | 14/02/2026 |

### Infraestrutura e CDN 🌐

| Feature | Status | Data |
|---------|--------|------|
| Bunny CDN para imagens (cdn.mdaccula.com) | ✅ | Fev/2026 |
| Fallback inteligente CDN → Supabase → placeholder | ✅ | Mar/2026 |
| Conversão WebP (client + server + batch) | ✅ | 02/02/2026 |
| Otimização de custos Cloud ($19 → $5-7/mês) | ✅ | 18/02/2026 |

### Performance 🚀

| Feature | Status | Data |
|---------|--------|------|
| Skeleton loading (Blog + Links) | ✅ | 13/01/2026 |
| StaticIcon (elimina waterfall de ícones) | ✅ | 02/02/2026 |
| Lazy DnD (DnD Kit só para admins) | ✅ | 02/02/2026 |
| Service Worker v5 (SWR para imagens) | ✅ | 13/01/2026 |
| React Query (eventos + links) | ✅ | 12/01/2026 |
| SiteSettingsContext global com cache | ✅ | 11/01/2026 |
| VirtualizedLinkList (>20 itens) | ✅ | 15/01/2026 |
| Debounce nos filtros de eventos | ✅ | 14/01/2026 |
| Query otimizada (select específico) | ✅ | 02/02/2026 |

### Segurança 🔐

| Feature | Status |
|---------|--------|
| Auditoria RLS completa | ✅ |
| Rate limiting (DB triggers + Edge Functions) | ✅ |
| Documentação de segurança | ✅ |
| Leaked Password Protection | ⚠️ Pendente (painel Supabase) |
| CAPTCHA no contato | ⚠️ Pendente |

### Qualidade de Código 🧪

| Feature | Status |
|---------|--------|
| Testes unitários + integração (Vitest) | ✅ |
| CI/CD GitHub Actions | ✅ |
| ESLint + Prettier | ✅ |
| Error Boundaries em todas as páginas | ✅ |
| Logger centralizado (info/warn/error) | ✅ |
| Barrel exports (hooks, lib, types) | ✅ |

### Documentação 📚

| Feature | Status | Data |
|---------|--------|------|
| README.md completo | ✅ | 13/07/2026 |
| PRD.md atualizado | ✅ | 13/07/2026 |
| ROADMAP.md atualizado | ✅ | 13/07/2026 |
| PENDENCIAS.md atualizado | ✅ | 15/03/2026 |
| SYSTEM-DESIGN.md | ✅ | 15/03/2026 |
| CODE_STYLE.md | ✅ | 06/01/2026 |
| SECURITY-AUDIT.md | ✅ | 15/03/2026 |

### Higiene técnica e paridade frontend↔edge 🧹 (Jul/2026)

| Feature | Status | Data |
|---------|--------|------|
| Unificação do renderer de e-mails (fonte única `_shared/emailBlocks.ts`) | ✅ | 07/2026 |
| Frontend virou reexport fino de `@shared/emailBlocks.ts` | ✅ | 07/2026 |
| Snapshot bilateral (`frontend-edge-render-parity.test.ts`) | ✅ | 07/2026 |
| Slim-down `EmailConfig.tsx` + `useEmailAutomation` | ✅ | 07/2026 |
| Slim-down `EventForm.tsx` e `LinksManager.tsx` | ✅ | 07/2026 |
| AbortController em Search / Events / Links / Blog | ✅ | 07/2026 |
| Roteamento de template por automação (weekly/weekend/blog) + validação de bloco dinâmico | ✅ | 07/2026 |
| Google Maps em domínio customizado (`public-maps-config` + chave própria com referrer allowlist + Maps Embed API) | ✅ | 13/07/2026 |
| Sitemap regenerado | ✅ | 13/07/2026 |

---

## Fase 3 - Expansão

**Período:** Março - Abril 2026  
**Status:** 🔄 INICIANDO  
**Objetivo:** Engajamento de audiência, conversão de leads e novas integrações

### UI/UX Premium — Microinterações (Jul/2026) ✨

Rodada de polimento visual com Framer Motion nas 3 páginas de maior tráfego, em micro-fases
(implementar → testar mobile → commit → push), documentada em detalhe na sessão original.

| Rodada | Página | Entregue |
|--------|--------|----------|
| D1 | Landing | Fundo Aurora animado no Hero (`AuroraBackground.tsx`), hook de tilt/parallax compartilhado (`useTiltParallax.ts`), botão magnético no CTA primário (`useMagneticHover.ts`) |
| L1 | /links | Fundo do tema animado, cores de marca reais por plataforma nos ícones (`brandColors.ts`), entrada em stagger nos tiles |
| E1 | Evento (`/eventos/:slug`) | Fundo ambiente com a própria arte do evento borrada atrás do banner, countdown até o início do evento + estado "Evento encerrado" (`EventCountdown.tsx`, conectando `isEventActive`), CTA "Comprar Ingresso" com borda em gradiente animado |
| E2 | Evento | Stagger no line-up/programação, cards de "Eventos Similares" com glow que segue o mouse (`SpotlightCard.tsx`, novo componente reutilizável), `ShareButtons` promovido de Popover para linha de ícones inline com cor de marca (compartilhado com o blog) |
| L2 | /links | Borda com brilho no hover dos tiles, glow pulsando no avatar, glow pulsando no link em destaque |
| L3 | /links | Ícone de confirmação (check) ao copiar link de grupo |
| D2 | Landing | `SpotlightCard` nos cards de eventos em destaque, barra animada no título das seções (`SectionHeading.tsx`), borda com brilho no card de CTA da rádio |
| D3 | Landing | Autoplay no carrossel de últimas notícias, com pausa ao passar o mouse |

Todas as animações usam `useReducedMotion()` do Framer Motion e seguem a convenção já existente de
desativar animações pesadas em mobile (ver `docs/CODE_STYLE.md` → seção Animações).

**Correção de performance relacionada:** durante o teste manual, a landing foi reportada como lenta
em produção e localhost. Investigação encontrou duas causas independentes — processos de dev server
duplicados (local) e, mais relevante, o agrupamento `manualChunks: { icons, charts }` em
`vite.config.ts` forçando ~991KB (ícones + gráficos usados em qualquer página, incluindo admin) a
carregar via `<link rel="modulepreload">` em **toda** página do site, mesmo as que não usam. Corrigido
removendo esse agrupamento — Rollup volta a fazer chunking automático por uso real. Commit
`55118bc`.

### Engajamento e Leads 📱

| Feature | Status | Prioridade |
|---------|--------|------------|
| Botão flutuante WhatsApp global | ⏳ Planejado | Alta |
| Deep links WhatsApp contextuais por página | ⏳ Planejado | Alta |
| Newsletter inline (Hero + fim de posts) | ⏳ Planejado | Alta |
| Botão "Adicionar ao Calendário" | ⏳ Planejado | Média |
| Compartilhar evento (WhatsApp, copiar link) | ✅ | 16/07/2026 |
| CTA de WhatsApp na página /links | ⏳ Planejado | Média |
| Tempo de leitura nos posts do blog | ⏳ Planejado | Baixa |
| Stagger animation nos links | ✅ | 16/07/2026 |

### PWA e Mobile 📱

| Feature | Status | Prioridade |
|---------|--------|------------|
| Push notifications | ⏳ Planejado | Alta |
| Instalação como app | ⏳ Planejado | Alta |
| Add to home screen prompt | ⏳ Planejado | Média |

### Integrações 🔗

| Feature | Status | Prioridade |
|---------|--------|------------|
| WhatsApp Business API | ⏳ Planejado | Média |
| Calendário Google/Apple (.ics) | ⏳ Planejado | Média |
| Instagram Stories feed | ⏳ Planejado | Baixa |
| Spotify embed dinâmico | ⏳ Planejado | Baixa |

### Analytics 2.0 📊

| Feature | Status | Prioridade |
|---------|--------|------------|
| Dashboard interativo avançado | ⏳ Planejado | Alta |
| Exportação de relatórios | ⏳ Planejado | Média |
| Funil de conversão | ⏳ Planejado | Média |

---

## Fase 4 - Escala

**Período:** Maio - Junho 2026  
**Status:** 💭 FUTURO  
**Objetivo:** Preparar para escala e novos mercados

### Mobile Nativo 📲

| Feature | Status |
|---------|--------|
| App React Native | 💭 Futuro |
| Push notifications nativo | 💭 Futuro |
| Deep linking | 💭 Futuro |

### Escala 📈

| Feature | Status |
|---------|--------|
| Multi-tenant (múltiplas agências) | 💭 Futuro |
| API pública | 💭 Futuro |
| Webhooks | 💭 Futuro |
| White-label | 💭 Futuro |

### Monetização 💰

| Feature | Status |
|---------|--------|
| Sistema de reservas | 💭 Futuro |
| Integração Stripe | 💭 Futuro |
| Planos de assinatura | 💭 Futuro |

---

## Backlog Futuro

| Feature | Complexidade | Valor |
|---------|--------------|-------|
| Suporte multi-idioma (i18n) | Média | Baixo |
| Gamificação (badges) | Média | Baixo |
| Chat ao vivo | Alta | Médio |
| Marketplace de ingressos | Alta | Alto |
| AI para recomendação de eventos | Alta | Alto |
| Timeline visual no Quem Somos | Média | Médio |
| Depoimentos de parceiros | Baixa | Médio |
| QR Code na página de links | Baixa | Médio |

---

## Timeline Visual

```
2025
 Dez │ ████████████████████████████ Fase 1 - MVP
─────┼────────────────────────────────────────────
2026 │
 Jan │ ████████████████ Fase 2 (automação + podcast)
 Fev │ ████████████████ Fase 2 (CDN + redirects + perf)
 Mar │ ████████████████ Fase 2 (docs + CDN fallback)
     │         ████████ Fase 3 início (engajamento)
 Abr │         ████████████████ Fase 3 (PWA + integrações)
 Mai │                  ████████ Fase 4 início
 Jun │                  ████████████████ Fase 4 completa
```

---

## Documentos Relacionados

| Documento | Descrição | Link |
|-----------|-----------|------|
| README.md | Documentação técnica | [/README.md](/README.md) |
| PRD.md | Requisitos do produto | [/docs/PRD.md](/docs/PRD.md) |
| PENDENCIAS.MD | Tarefas e histórico | [/PENDENCIAS.MD](/PENDENCIAS.MD) |
| CODE_STYLE.md | Guia de código | [/docs/CODE_STYLE.md](/docs/CODE_STYLE.md) |
| SECURITY-AUDIT.md | Auditoria segurança | [/docs/SECURITY-AUDIT.md](/docs/SECURITY-AUDIT.md) |
| SYSTEM-DESIGN.md | Arquitetura técnica | [/docs/SYSTEM-DESIGN.md](/docs/SYSTEM-DESIGN.md) |

---

## Histórico de Revisões

| Versão | Data | Descrição |
|--------|------|-----------|
| 1.0 | 06/01/2026 | Documento inicial |
| 1.1 | 10/01/2026 | Eventos recorrentes, automação e docs |
| 1.2 | 23/01/2026 | Programa de Podcast e System Design |
| 1.3 | 15/03/2026 | Fase 2 concluída. Adicionados: redirects UTM, CDN fallback, importação CSV, otimização custos, performance. Fase 3 planejada com foco em engajamento |
| 1.4 | 13/07/2026 | Higiene técnica finalizada: renderer de e-mails unificado (frontend↔edge byte-idêntico), slim-down de EmailConfig/EventForm/LinksManager, AbortController em telas com busca, roteamento de template por automação e Google Maps operando em `mdaccula.com` via chave própria + Maps Embed API |
| 1.5 | 16/07/2026 | UI/UX Premium: microinterações com Framer Motion em 8 rodadas (D1/L1/E1/E2/L2/L3/D2/D3) na landing, evento e /links; correção de performance de build (manualChunks de icons/charts removido, ~991KB a menos de preload eager por página) |

---

*Última atualização: 16/07/2026*
