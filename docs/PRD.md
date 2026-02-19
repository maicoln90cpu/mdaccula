# Product Requirements Document (PRD)

## MDAccula - Plataforma de Agência de Música Eletrônica

**Versão:** 1.2  
**Data:** 23/01/2026  
**Status:** MVP Concluído + Fase 2 em Andamento

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

### Solução Proposta

Uma plataforma all-in-one que oferece:
- Website público responsivo com eventos e blog
- Sistema de geração de conteúdo por IA
- Página de links personalizável (estilo Linktree)
- Painel administrativo completo
- Analytics integrado
- Newsletter com testes A/B
- **Eventos recorrentes automatizados**

---

## Objetivos

### Objetivos de Negócio

| Objetivo | Métrica | Meta |
|----------|---------|------|
| Aumentar visibilidade online | Pageviews mensais | 10.000+ |
| Gerar conteúdo consistente | Artigos por mês | 15-30 via IA |
| Centralizar links | Cliques em links | 5.000+ mensais |
| Converter audiência | Inscritos newsletter | 1.000+ |

### Objetivos Técnicos

| Objetivo | Métrica | Meta |
|----------|---------|------|
| Performance | Lighthouse Score | 90+ |
| Disponibilidade | Uptime | 99.9% |
| Segurança | Vulnerabilidades críticas | 0 |
| Manutenibilidade | Cobertura de testes | 60%+ |

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
- **Necessidades:** Criar e compartilhar conteúdo
- **Dores:** Produzir conteúdo original constantemente
- **Como atendemos:** Blog com IA + página de links

#### 3. Público Final
- **Quem:** Fãs de música eletrônica
- **Necessidades:** Descobrir eventos e consumir conteúdo
- **Dores:** Informações fragmentadas em múltiplas plataformas
- **Como atendemos:** Site centralizado + newsletter + carousel mobile

---

## Funcionalidades

### MVP (Concluído ✅)

#### Website Público
- [x] Homepage com hero, eventos em destaque e últimas notícias
- [x] Página de eventos com filtros (cidade, gênero)
- [x] **Carousel de eventos mobile** *(novo - Jan/2026)*
- [x] Página de detalhe de evento
- [x] Blog com busca full-text
- [x] Página de artigo individual
- [x] Página de links personalizável
- [x] Página institucional (Quem Somos)
- [x] Formulário de contato com email
- [x] **Página de Podcast com formulário de inscrição** *(novo - Jan/2026)*
- [x] SEO otimizado (meta tags, sitemap, RSS)

#### Painel Administrativo
- [x] Autenticação com roles (admin/user)
- [x] CRUD de eventos com templates
- [x] **Eventos recorrentes automatizados (D.EDGE)** *(novo - Jan/2026)*
- [x] CRUD de posts do blog
- [x] CRUD de links e grupos
- [x] Gestão de equipe
- [x] Configurações do sistema
- [x] Dashboard de analytics
- [x] Dashboard de saúde do sistema
- [x] **Gerenciador de inscrições do Podcast** *(novo - Jan/2026)*

#### Sistema de IA
- [x] Geração de sugestões de artigos
- [x] Geração automática de artigos
- [x] Geração de imagens (Nano Banana)
- [x] **Prompt de imagem aprimorado com 6 variáveis** *(novo - Jan/2026)*
- [x] Múltiplos modelos (Gemini, GPT)
- [x] Agendamento via cron
- [x] Templates de prompts configuráveis

#### Newsletter
- [x] Popup de inscrição com A/B testing
- [x] Gestão de inscritos
- [x] Envio em massa

#### Analytics
- [x] Views de posts e eventos
- [x] Cliques em links
- [x] Compartilhamentos
- [x] Custos de geração IA

#### Programa de Podcast *(novo - Jan/2026)*
- [x] Página pública com hero section e informações do programa
- [x] Formulário de inscrição validado com Zod (13+ campos)
- [x] Edge Function para notificações por email (artista + agência)
- [x] Dashboard admin com filtros por status
- [x] Cards de métricas (total, pendentes, aprovados, taxa conversão)
- [x] Gerenciamento de status e notas admin
- [x] Exportação CSV

### Próximas Fases (Ver ROADMAP.md)

- [ ] PWA completo com push notifications
- [ ] Dashboard de analytics avançado
- [ ] Integração com Instagram/Spotify
- [ ] App mobile nativo
- [ ] Sistema de reservas/ingressos

---

## Requisitos Técnicos

### Stack Obrigatória

| Componente | Tecnologia | Justificativa |
|------------|------------|---------------|
| Frontend | React + TypeScript | Lovable Platform |
| Estilização | Tailwind CSS | Design System |
| Backend | Supabase (PostgreSQL) | Lovable Cloud |
| Serverless | Edge Functions (Deno) | Lógica de negócio |
| AI | Lovable AI Gateway | Custo-benefício |

### Requisitos Não-Funcionais

| Requisito | Especificação |
|-----------|---------------|
| Performance | LCP < 2.5s, FID < 100ms, CLS < 0.1 |
| Segurança | RLS em todas as tabelas, rate limiting |
| Acessibilidade | WCAG 2.1 AA |
| SEO | Core Web Vitals verde |
| Mobile | Mobile-first responsive |

### Integrações Externas

| Serviço | Uso | Obrigatório |
|---------|-----|-------------|
| Lovable AI | Geração de conteúdo | ✅ |
| OpenAI | Modelos alternativos | ❌ |
| Firecrawl | Scraping de fontes | ❌ |
| Resend | Envio de emails | ✅ |
| GTM/Hotjar | Analytics | ❌ |

---

## Backlog do Produto

### Prioridade Alta 🔴

| ID | Feature | Status | Sprint |
|----|---------|--------|--------|
| P01 | Habilitar Leaked Password Protection | Pendente | Next |
| P02 | CAPTCHA no formulário de contato | Pendente | Next |
| P03 | Dashboard de saúde do sistema | ✅ Concluído | - |
| P04 | Testes automatizados | ✅ Concluído | - |
| P05 | Eventos recorrentes D.EDGE | ✅ Concluído | - |

### Prioridade Média 🟡

| ID | Feature | Status | Sprint |
|----|---------|--------|--------|
| M01 | Push notifications (PWA) | Pendente | Fase 3 |
| M02 | Integração Instagram Stories | Pendente | Fase 3 |
| M03 | Relatórios de analytics exportáveis | Pendente | Fase 3 |
| M04 | Sistema de agendamento de posts | Pendente | Fase 3 |

### Prioridade Baixa 🟢

| ID | Feature | Status | Sprint |
|----|---------|--------|--------|
| L01 | Guia de onboarding interativo | Pendente | Fase 4 |
| L02 | Tema claro/modo light | Pendente | Fase 4 |
| L03 | Suporte multi-idioma (i18n) | Pendente | Fase 4 |
| L04 | App mobile nativo | Pendente | Fase 4 |

---

## Métricas de Sucesso

### KPIs Técnicos

| Métrica | Baseline | Meta | Atual |
|---------|----------|------|-------|
| Lighthouse Performance | - | 90+ | TBD |
| Lighthouse SEO | - | 100 | TBD |
| Uptime | - | 99.9% | TBD |
| Tempo de build | - | < 60s | TBD |
| Bundle size | - | < 500KB gzip | TBD |

### KPIs de Produto

| Métrica | Baseline | Meta 3 meses |
|---------|----------|--------------|
| Pageviews mensais | 0 | 10.000 |
| Usuários únicos | 0 | 2.000 |
| Artigos gerados/mês | 0 | 15 |
| Cliques em links | 0 | 5.000 |
| Inscritos newsletter | 0 | 500 |

---

## Documentos Relacionados

| Documento | Descrição | Link |
|-----------|-----------|------|
| README.md | Documentação técnica principal | [/README.md](/README.md) |
| ROADMAP.md | Fases e cronograma | [/docs/ROADMAP.md](/docs/ROADMAP.md) |
| PENDENCIAS.MD | Tarefas e histórico | [/PENDENCIAS.MD](/PENDENCIAS.MD) |
| CODE_STYLE.md | Guia de estilo de código | [/docs/CODE_STYLE.md](/docs/CODE_STYLE.md) |
| SECURITY-AUDIT.md | Auditoria de segurança | [/docs/SECURITY-AUDIT.md](/docs/SECURITY-AUDIT.md) |
| tabelas.md | Documentação do banco | [/tabelas.md](/tabelas.md) |

---

## Histórico de Revisões

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | 06/01/2026 | Sistema | Documento inicial |
| 1.1 | 10/01/2026 | Sistema | Atualizado com eventos recorrentes, carousel mobile e melhorias IA |
| 1.2 | 23/01/2026 | Sistema | Adicionado Programa de Podcast completo |

---

*Última atualização: 23/01/2026*
