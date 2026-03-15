# Product Requirements Document (PRD)

## MDAccula - Plataforma de Agência de Música Eletrônica

**Versão:** 1.3  
**Data:** 15/03/2026  
**Status:** Fase 2 Concluída, Fase 3 em Andamento

---

## 📋 Índice

1. [Visão do Produto](#visão-do-produto)
2. [Objetivos](#objetivos)
3. [Público-Alvo](#público-alvo)
4. [Funcionalidades](#funcionalidades)
5. [Requisitos Técnicos](#requisitos-técnicos)
6. [Backlog do Produto](#backlog-do-produto)
7. [Métricas de Sucesso](#métricas-de-sucesso)
8. [Documentos Relacionados](#documentos-relacionados)

---

## Visão do Produto

### Declaração de Visão

> Criar a plataforma digital mais completa para agências de música eletrônica no Brasil, combinando gestão de eventos, conteúdo automatizado por IA, e ferramentas de engajamento de audiência.

### Problema a Resolver

Agências de música eletrônica enfrentam desafios para:
- Manter um site atualizado com eventos e conteúdo
- Gerar conteúdo relevante de forma consistente
- Centralizar links e informações para a audiência
- Acompanhar métricas de engajamento
- Gerenciar newsletters e comunicação
- Rastrear a efetividade de links em campanhas

### Solução Proposta

Uma plataforma all-in-one que oferece:
- Website público responsivo com eventos e blog
- Sistema de geração de conteúdo por IA (dual: OpenAI + Gemini)
- Página de links personalizável (estilo Linktree)
- Redirecionador de links com UTM tracking
- Painel administrativo completo
- Analytics integrado
- Newsletter com testes A/B
- Eventos recorrentes automatizados
- Programa de Podcast para captação de DJs
- CDN dedicado para imagens com fallback inteligente

---

## Objetivos

### Objetivos de Negócio

| Objetivo | Métrica | Meta |
|----------|---------|------|
| Aumentar visibilidade online | Pageviews mensais | 10.000+ |
| Gerar conteúdo consistente | Artigos por mês | 15-30 via IA |
| Centralizar links | Cliques em links | 5.000+ mensais |
| Converter audiência | Inscritos newsletter | 1.000+ |
| Captar DJs | Inscrições podcast | 50+ |
| Rastrear campanhas | Redirects com UTM | 100% campanhas trackadas |

### Objetivos Técnicos

| Objetivo | Métrica | Meta |
|----------|---------|------|
| Performance | Lighthouse Score | 90+ |
| Disponibilidade | Uptime | 99.9% |
| Segurança | Vulnerabilidades críticas | 0 |
| Custo Cloud | Gasto mensal | < $10/mês |

---

## Público-Alvo

### Personas

#### 1. Administrador da Agência
- **Quem:** Dono ou gerente da agência
- **Necessidades:** Gerenciar eventos, conteúdo e equipe
- **Dores:** Falta de tempo para atualizar o site
- **Como atendemos:** Painel admin intuitivo + geração IA + eventos recorrentes automatizados

#### 2. Equipe de Marketing
- **Quem:** Social media e marketing
- **Necessidades:** Criar e compartilhar conteúdo, rastrear campanhas
- **Dores:** Produzir conteúdo original constantemente
- **Como atendemos:** Blog com IA + página de links + redirects com UTM

#### 3. Público Final
- **Quem:** Fãs de música eletrônica
- **Necessidades:** Descobrir eventos e consumir conteúdo
- **Dores:** Informações fragmentadas em múltiplas plataformas
- **Como atendemos:** Site centralizado + newsletter + carousel mobile

#### 4. DJs e Produtores
- **Quem:** Artistas que querem participar do programa de podcast
- **Necessidades:** Canal para divulgar trabalho
- **Como atendemos:** Formulário MDAccula Radio + notificação automática

---

## Funcionalidades

### Fase 1 - MVP (Concluído ✅)

- [x] Homepage com hero, eventos em destaque e últimas notícias
- [x] Página de eventos com filtros (cidade, gênero, estado)
- [x] Carousel de eventos mobile (Embla Carousel)
- [x] Página de detalhe de evento
- [x] Blog com busca full-text (tsvector português)
- [x] Página de links personalizável (13+ temas)
- [x] Página institucional (Quem Somos)
- [x] Formulário de contato com email
- [x] SEO otimizado (meta tags, sitemap estático + dinâmico, RSS)
- [x] Autenticação com roles (admin/moderator/user)
- [x] CRUD de eventos com templates
- [x] Sistema de IA: sugestões + geração + imagens + cron
- [x] Newsletter com popup A/B testing
- [x] Analytics (views, cliques, shares, custos IA)

### Fase 2 - Consolidação (Concluído ✅)

- [x] Eventos recorrentes automatizados (D.EDGE) via pg_cron
- [x] Programa de Podcast (MDAccula Radio) completo
- [x] Redirecionador de links com UTM tracking (/r/:slug)
- [x] Importação de dados via CSV
- [x] Roteamento dual IA (OpenAI direto / Gemini via Lovable)
- [x] Filtro de links fake na geração IA
- [x] CDN com fallback inteligente (Bunny → Supabase → placeholder)
- [x] Otimização de custos Cloud ($19 → $5-7/mês)
- [x] Conversão WebP automática (client-side + server-side)
- [x] Performance /links (skeleton, StaticIcon, lazy DnD, cache SW)
- [x] Virtualização de listas (VirtualizedLinkList)
- [x] Logger centralizado + cleanup automático
- [x] Testes automatizados + CI/CD GitHub Actions
- [x] Documentação técnica completa
- [x] Auditoria de segurança (RLS, rate limiting, escapeHtml)

### Fase 3 - Expansão (Em Andamento 🔄)

- [ ] Botão flutuante de WhatsApp global com deep links
- [ ] Newsletter inline (Hero + Blog) sem depender de popup
- [ ] Botão "Adicionar ao Calendário" nos eventos
- [ ] Compartilhamento social em eventos e blog
- [ ] PWA com push notifications
- [ ] Integrações Instagram/Spotify
- [ ] Dashboard de analytics avançado

---

## Requisitos Técnicos

### Stack Obrigatória

| Componente | Tecnologia | Justificativa |
|------------|------------|---------------|
| Frontend | React + TypeScript | Lovable Platform |
| Estilização | Tailwind CSS + Shadcn/UI | Design System |
| Backend | Supabase (PostgreSQL) | Lovable Cloud |
| Serverless | Edge Functions (Deno) | Lógica de negócio |
| AI | Lovable AI Gateway + OpenAI | Dual routing |
| CDN | Bunny CDN | Cache de imagens |

### Requisitos Não-Funcionais

| Requisito | Especificação |
|-----------|---------------|
| Performance | LCP < 2.5s, FID < 100ms, CLS < 0.1 |
| Segurança | RLS em todas as tabelas, rate limiting |
| Acessibilidade | WCAG 2.1 AA |
| SEO | Core Web Vitals verde |
| Mobile | Mobile-first responsive |

---

## Backlog do Produto

### Prioridade Alta 🔴

| ID | Feature | Status |
|----|---------|--------|
| P01 | Botão flutuante WhatsApp global | ⏳ Planejado |
| P02 | Newsletter inline (Hero + fim de posts) | ⏳ Planejado |
| P03 | CAPTCHA no formulário de contato | ⏳ Pendente |
| P04 | Leaked Password Protection | ⏳ Pendente (painel Supabase) |

### Prioridade Média 🟡

| ID | Feature | Status |
|----|---------|--------|
| M01 | Botão "Adicionar ao Calendário" (Google/.ics) | ⏳ Planejado |
| M02 | Compartilhar evento via WhatsApp/copiar link | ⏳ Planejado |
| M03 | Push notifications (PWA) | ⏳ Planejado |
| M04 | Relatórios de analytics exportáveis | ⏳ Planejado |

### Prioridade Baixa 🟢

| ID | Feature | Status |
|----|---------|--------|
| L01 | Guia de onboarding interativo | ⏳ Planejado |
| L02 | Tema claro/modo light | ⏳ Planejado |
| L03 | Suporte multi-idioma (i18n) | ⏳ Futuro |
| L04 | App mobile nativo | ⏳ Futuro |

---

## Métricas de Sucesso

### KPIs Técnicos

| Métrica | Meta | Status |
|---------|------|--------|
| Lighthouse Performance | 90+ | TBD |
| Lighthouse SEO | 100 | TBD |
| Uptime | 99.9% | ✅ |
| Custo Cloud mensal | < $10 | ✅ (~$5-7) |
| Bundle size | < 500KB gzip | TBD |

### KPIs de Produto

| Métrica | Meta 3 meses |
|---------|--------------|
| Pageviews mensais | 10.000 |
| Usuários únicos | 2.000 |
| Artigos gerados/mês | 15 |
| Cliques em links | 5.000 |
| Inscritos newsletter | 500 |

---

## Documentos Relacionados

| Documento | Descrição | Link |
|-----------|-----------|------|
| README.md | Documentação técnica principal | [/README.md](/README.md) |
| ROADMAP.md | Fases e cronograma | [/docs/ROADMAP.md](/docs/ROADMAP.md) |
| PENDENCIAS.MD | Tarefas e histórico | [/PENDENCIAS.MD](/PENDENCIAS.MD) |
| CODE_STYLE.md | Guia de estilo de código | [/docs/CODE_STYLE.md](/docs/CODE_STYLE.md) |
| SECURITY-AUDIT.md | Auditoria de segurança | [/docs/SECURITY-AUDIT.md](/docs/SECURITY-AUDIT.md) |
| SYSTEM-DESIGN.md | Arquitetura técnica | [/docs/SYSTEM-DESIGN.md](/docs/SYSTEM-DESIGN.md) |
| tabelas.md | Documentação do banco | [/tabelas.md](/tabelas.md) |

---

## Histórico de Revisões

| Versão | Data | Descrição |
|--------|------|-----------|
| 1.0 | 06/01/2026 | Documento inicial |
| 1.1 | 10/01/2026 | Eventos recorrentes, carousel mobile, melhorias IA |
| 1.2 | 23/01/2026 | Programa de Podcast completo |
| 1.3 | 15/03/2026 | Fase 2 concluída. Adicionados: redirects UTM, importação CSV, CDN fallback, otimização custos, dual IA routing. Backlog atualizado para Fase 3 |

---

*Última atualização: 15/03/2026*
