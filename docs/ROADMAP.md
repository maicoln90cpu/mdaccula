# Roadmap - MDAccula

## Visão Geral do Desenvolvimento

> Planejamento de fases, prioridades e cronograma para evolução da plataforma.

**Versão:** 1.2  
**Data:** 23/01/2026  
**Status Atual:** Fase 2 - Consolidação em andamento

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
│  Fase 2: Consolidação    │  Status: 🔄 EM ANDAMENTO            │
│  Jan-Fev/2026            │  Segurança + Automação + Docs       │
├─────────────────────────────────────────────────────────────────┤
│  Fase 3: Expansão        │  Status: ⏳ PLANEJADO               │
│  Mar-Abr/2026            │  PWA + Integrações + Analytics 2.0  │
├─────────────────────────────────────────────────────────────────┤
│  Fase 4: Escala          │  Status: 💭 FUTURO                  │
│  Mai-Jun/2026            │  Mobile App + Multi-tenant + APIs   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fase 1 - MVP

**Período:** Dezembro 2025 - Janeiro 2026  
**Status:** ✅ CONCLUÍDO  
**Objetivo:** Lançar plataforma funcional com todas as features core

### Features Entregues

#### Website Público ✅
| Feature | Status | Data |
|---------|--------|------|
| Homepage com hero e seções | ✅ Concluído | Dez/2025 |
| Lista de eventos com filtros | ✅ Concluído | Dez/2025 |
| Página de detalhe de evento | ✅ Concluído | Dez/2025 |
| Blog com busca full-text | ✅ Concluído | Dez/2025 |
| Página de artigo | ✅ Concluído | Dez/2025 |
| Página de links (Linktree-style) | ✅ Concluído | Dez/2025 |
| Página Quem Somos | ✅ Concluído | Dez/2025 |
| Formulário de contato | ✅ Concluído | Dez/2025 |
| SEO (meta tags, sitemap, RSS) | ✅ Concluído | Dez/2025 |

#### Painel Administrativo ✅
| Feature | Status | Data |
|---------|--------|------|
| Autenticação com roles | ✅ Concluído | Dez/2025 |
| CRUD de eventos | ✅ Concluído | Dez/2025 |
| Templates de eventos | ✅ Concluído | Dez/2025 |
| CRUD de posts do blog | ✅ Concluído | Dez/2025 |
| CRUD de links e grupos | ✅ Concluído | Dez/2025 |
| Gestão de equipe | ✅ Concluído | Dez/2025 |
| Configurações do sistema | ✅ Concluído | Dez/2025 |

#### Sistema de IA ✅
| Feature | Status | Data |
|---------|--------|------|
| Geração de sugestões | ✅ Concluído | Dez/2025 |
| Geração de artigos | ✅ Concluído | Dez/2025 |
| Geração de imagens | ✅ Concluído | Dez/2025 |
| Múltiplos modelos (Gemini/GPT) | ✅ Concluído | Dez/2025 |
| Agendamento automático (cron) | ✅ Concluído | Jan/2026 |
| Templates de prompts | ✅ Concluído | Dez/2025 |

#### Newsletter ✅
| Feature | Status | Data |
|---------|--------|------|
| Popup de inscrição | ✅ Concluído | Dez/2025 |
| Testes A/B | ✅ Concluído | Dez/2025 |
| Gestão de inscritos | ✅ Concluído | Dez/2025 |
| Envio em massa | ✅ Concluído | Dez/2025 |

#### Analytics ✅
| Feature | Status | Data |
|---------|--------|------|
| Views de posts/eventos | ✅ Concluído | Dez/2025 |
| Cliques em links | ✅ Concluído | Dez/2025 |
| Compartilhamentos | ✅ Concluído | Dez/2025 |
| Custos de geração IA | ✅ Concluído | Dez/2025 |

---

## Fase 2 - Consolidação

**Período:** Janeiro - Fevereiro 2026  
**Status:** 🔄 EM ANDAMENTO  
**Objetivo:** Fortalecer segurança, automação e documentação

### Automação 🤖

| Feature | Status | Prioridade | Data |
|---------|--------|------------|------|
| Cron job eventos recorrentes D.EDGE | ✅ Concluído | Alta | 09/01/2026 |
| Página admin eventos recorrentes | ✅ Concluído | Alta | 09/01/2026 |
| Carousel mobile de eventos | ✅ Concluído | Média | 09/01/2026 |
| Prompt de imagem aprimorado | ✅ Concluído | Alta | 07/01/2026 |

### Programa de Podcast 🎙️ *(novo)*

| Feature | Status | Prioridade | Data |
|---------|--------|------------|------|
| Tabela podcast_submissions | ✅ Concluído | Alta | 23/01/2026 |
| Edge Function notificações | ✅ Concluído | Alta | 23/01/2026 |
| Tipos TypeScript | ✅ Concluído | Alta | 23/01/2026 |
| Página pública /MDAcculaRadio | ✅ Concluído | Alta | 23/01/2026 |
| Dashboard admin | ✅ Concluído | Alta | 23/01/2026 |
| Exportação CSV | ✅ Concluído | Média | 23/01/2026 |

### Segurança 🔐

| Feature | Status | Prioridade | Responsável |
|---------|--------|------------|-------------|
| Leaked Password Protection | 🔴 Pendente | Alta | Admin |
| CAPTCHA no contato | 🔴 Pendente | Média | Dev |
| Rate limiting (edge functions) | ✅ Concluído | Alta | Sistema |
| Auditoria RLS completa | ✅ Concluído | Alta | Sistema |
| Documentação de segurança | ✅ Concluído | Média | Sistema |

### Qualidade de Código 🧪

| Feature | Status | Prioridade | Responsável |
|---------|--------|------------|-------------|
| Testes unitários | ✅ Concluído | Alta | Sistema |
| Testes de integração | ✅ Concluído | Alta | Sistema |
| CI/CD GitHub Actions | ✅ Concluído | Alta | Sistema |
| Linting + Prettier | ✅ Concluído | Média | Sistema |
| Error Boundaries | ✅ Concluído | Alta | Sistema |
| Logging centralizado | ✅ Concluído | Média | Sistema |

### Documentação 📚

| Feature | Status | Prioridade | Data |
|---------|--------|------------|------|
| README atualizado | ✅ Concluído | Alta | 23/01/2026 |
| PRD.md atualizado | ✅ Concluído | Alta | 23/01/2026 |
| ROADMAP.md atualizado | ✅ Concluído | Alta | 23/01/2026 |
| PENDENCIAS.md atualizado | ✅ Concluído | Alta | 23/01/2026 |
| CODE_STYLE.md | ✅ Concluído | Média | 06/01/2026 |
| SECURITY-AUDIT.md | ✅ Concluído | Alta | 06/01/2026 |
| SYSTEM-DESIGN.md | ✅ Concluído | Alta | 23/01/2026 |

### Performance 🚀

| Feature | Status | Prioridade | Responsável |
|---------|--------|------------|-------------|
| Otimização de queries N+1 | ✅ Concluído | Alta | Sistema |
| Lazy loading de imagens | ✅ Concluído | Média | Sistema |
| Service Worker otimizado | ✅ Concluído | Média | Sistema |
| Bundle optimization | 🟡 Pendente | Média | Dev |

---

## Fase 3 - Expansão

**Período:** Março - Abril 2026  
**Status:** ⏳ PLANEJADO  
**Objetivo:** Novas funcionalidades e integrações

### PWA e Mobile 📱

| Feature | Status | Prioridade |
|---------|--------|------------|
| Push notifications | ⏳ Planejado | Alta |
| Instalação como app | ⏳ Planejado | Alta |
| Modo offline robusto | ⏳ Planejado | Média |
| Add to home screen prompt | ⏳ Planejado | Média |

### Integrações 🔗

| Feature | Status | Prioridade |
|---------|--------|------------|
| Instagram Stories feed | ⏳ Planejado | Média |
| Spotify embed dinâmico | ⏳ Planejado | Baixa |
| WhatsApp Business API | ⏳ Planejado | Média |
| Calendário Google/Apple | ⏳ Planejado | Baixa |

### Analytics 2.0 📊

| Feature | Status | Prioridade |
|---------|--------|------------|
| Dashboard interativo | ⏳ Planejado | Alta |
| Exportação de relatórios | ⏳ Planejado | Média |
| Heatmaps integrados | ⏳ Planejado | Baixa |
| Funil de conversão | ⏳ Planejado | Média |

### UX Improvements 🎨

| Feature | Status | Prioridade |
|---------|--------|------------|
| Guia de onboarding | ⏳ Planejado | Baixa |
| Tema claro (light mode) | ⏳ Planejado | Baixa |
| Acessibilidade WCAG 2.1 AAA | ⏳ Planejado | Média |
| Animações aprimoradas | ⏳ Planejado | Baixa |

---

## Fase 4 - Escala

**Período:** Maio - Junho 2026  
**Status:** 💭 FUTURO  
**Objetivo:** Preparar para escala e novos mercados

### Mobile Nativo 📲

| Feature | Status | Prioridade |
|---------|--------|------------|
| App React Native | 💭 Futuro | Alta |
| Push notifications nativo | 💭 Futuro | Alta |
| Deep linking | 💭 Futuro | Média |

### Escala 📈

| Feature | Status | Prioridade |
|---------|--------|------------|
| Multi-tenant (múltiplas agências) | 💭 Futuro | Alta |
| API pública | 💭 Futuro | Média |
| Webhooks | 💭 Futuro | Média |
| White-label | 💭 Futuro | Baixa |

### Monetização 💰

| Feature | Status | Prioridade |
|---------|--------|------------|
| Sistema de reservas | 💭 Futuro | Alta |
| Integração Stripe | 💭 Futuro | Alta |
| Planos de assinatura | 💭 Futuro | Média |

---

## Backlog Futuro

### Features Consideradas (não priorizadas)

| Feature | Complexidade | Valor | Notas |
|---------|--------------|-------|-------|
| Suporte multi-idioma (i18n) | Média | Baixo | Foco inicial no Brasil |
| Gamificação (badges) | Média | Baixo | Engajamento |
| Chat ao vivo | Alta | Médio | Suporte |
| Marketplace de ingressos | Alta | Alto | Monetização |
| AI para recomendação de eventos | Alta | Alto | Personalização |

---

## Timeline Visual

```
2025
 Dez │ ████████████████████████████ Fase 1 - MVP
─────┼────────────────────────────────────────────
2026 │
 Jan │ ████████████████ Fase 2 (automação + docs)
 Fev │ ████████████████ Fase 2 (segurança + perf)
 Mar │         ████████ Fase 3 início
 Abr │         ████████████████ Fase 3 completa
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

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | 06/01/2026 | Sistema | Documento inicial |
| 1.1 | 10/01/2026 | Sistema | Atualizado com eventos recorrentes, automação e docs |
| 1.2 | 23/01/2026 | Sistema | Adicionado Programa de Podcast e System Design |

---

*Última atualização: 23/01/2026*
