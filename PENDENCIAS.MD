# Pendências - MDAccula

> Registro de alterações, bugs, melhorias e histórico do projeto

**Última atualização:** 15/03/2026

---

## ✅ Concluído Recentemente

### Fallback Inteligente de Imagens CDN
**Status:** concluído  
**Descrição:** Sistema de fallback em 3 camadas para imagens: Bunny CDN → Supabase Storage direto → placeholder genérico. Resolve problema de cache corrompido no CDN sem depender de purge manual.  
**Data:** 15/03/2026  
**Responsável:** IA  
**Impacto:** alto  

**Alterações:**
1. **imageUtils.ts** - Nova função `getOriginalSupabaseUrl()` reverte URL CDN para Supabase
2. **OptimizedImage.tsx** - `onError` tenta Supabase antes do gradiente
3. **Eventos.tsx** - `onError` tenta Supabase antes de `djImage`
4. **Blog.tsx** - `onError` tenta Supabase antes de `djImage`
5. **LatestNews.tsx** - Corrigida dupla chamada de `getOptimizedImageUrl`
6. **LinkCardImage.tsx** - Fallback CDN → Supabase → placeholder

**Arquivos alterados:**
- `src/lib/imageUtils.ts`
- `src/components/OptimizedImage.tsx`
- `src/pages/Eventos.tsx`
- `src/pages/Blog.tsx`
- `src/components/sections/LatestNews.tsx`
- `src/components/links/LinkCardImage.tsx`

---

### Atualização Completa da Documentação (v1.3)
**Status:** concluído  
**Descrição:** Auditoria e atualização de todos os 7 documentos técnicos. Versão 1.3.0, datas atualizadas para 15/03/2026, todas as features de Fase 2 documentadas, cross-references entre documentos corrigidas.  
**Data:** 15/03/2026  
**Responsável:** IA  
**Impacto:** médio  

**Documentos atualizados:**
- `README.md` - v1.3.0, 25 tabelas, 20+ edge functions, CDN section, rotas completas
- `docs/PRD.md` - Fase 2 concluída, backlog Fase 3, persona DJs
- `docs/ROADMAP.md` - Fase 2 ✅, Fase 3 iniciando com itens de engajamento
- `docs/SYSTEM-DESIGN.md` - Fluxos redirect/CDN, dual IA routing, arquitetura CDN
- `docs/SECURITY-AUDIT.md` - 25 tabelas RLS, redirect/tracking policies
- `PENDENCIAS.MD` - Entradas recentes adicionadas

---

### Otimização de Custos Cloud ($19 → estimativa $5-7/mês)
**Status:** concluído  
**Descrição:** Três otimizações para reduzir custos cloud: desativado persist-logs remoto, reduzido retenção de logs de 30→7 dias, cron de auto-geração alterado de 1h→6h, corrigido bug SUPABASE_URL na edge function generate-blog-suggestions.  
**Data:** 18/02/2026  
**Responsável:** IA  
**Impacto:** alto  

**Alterações:**
1. **logger.ts** - `enableRemote: false` (era `!import.meta.env.DEV`), eliminando ~742 chamadas desnecessárias à edge function persist-logs
2. **cleanup_old_logs()** - Retenção reduzida de 30 para 7 dias em application_logs e performance_metrics
3. **Cron auto-generate-article-hourly** - Alterado de `0 * * * *` (720x/mês) para `0 */6 * * *` (120x/mês), redução de 83%
4. **generate-blog-suggestions** - Corrigido bug crítico: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` não eram declarados via `Deno.env.get()` antes do uso
5. **application_logs** - Limpeza manual de registros >7 dias (835 registros removidos)

**Arquivos alterados:**
- `src/lib/logger.ts`
- `supabase/functions/generate-blog-suggestions/index.ts`

---

## ✅ Concluído Recentemente

### Redirecionador de Links com UTM Tracking
**Status:** concluído  
**Descrição:** Sistema completo de links curtos (mdaccula.com/r/:slug) com redirecionamento, UTM tracking automático e contagem de cliques. Painel admin em /admin/redirects para criar, editar, ativar/desativar e monitorar links. Edge function track-redirect-click para contagem atômica.  
**Data:** 15/02/2026  
**Responsável:** IA  
**Impacto:** alto  

**Arquivos criados:**
- `supabase/functions/track-redirect-click/index.ts`
- `src/pages/Redirect.tsx`
- `src/pages/admin/RedirectsManager.tsx`

**Arquivos alterados:**
- `src/App.tsx` (rotas /r/:slug e /admin/redirects)
- `src/pages/Admin.tsx` (card no menu admin)
- `supabase/config.toml` (nova edge function)

---

### Condicional Lista VIP/Social + Fix Card Desktop
**Status:** concluído  
**Descrição:** Card de ingressos agora exibe "Lista VIP/Social" e "Enviar Nome para Lista" quando ticket_link contém postcontrol.com.br/mdaccula/lista. Corrigido bug onde o card sumia no desktop (faltava wrapper condicional no card `hidden lg:block`).  
**Data:** 14/02/2026  
**Responsável:** IA  
**Impacto:** alto  

---


### Roteamento Dual IA (OpenAI Direto / Gemini via Lovable)
**Status:** concluído  
**Descrição:** Todas as Edge Functions de IA agora respeitam o seletor de agente do admin. Modelos OpenAI usam OPENAI_API_KEY direto em api.openai.com, modelos Gemini usam LOVABLE_API_KEY via gateway Lovable AI.  
**Data:** 14/02/2026  
**Responsável:** IA  
**Impacto:** alto  

**Alterações:**
1. **generate-blog-suggestions** - Removido modelo hardcoded `google/gemini-2.5-flash`, agora lê `ai_blog_model` do settings + roteamento dual OpenAI/Gemini + temperature condicional
2. **generate-multi-event-article** - Implementado roteamento dual OpenAI/Gemini + removida dependência `imagescript` (causava erro `encodeWEBP`) + upload direto como PNG
3. **EventDetail.tsx** - Card "Ingressos com Desconto" movido para após badges de gênero no mobile (`lg:hidden`), mantido no sidebar no desktop (`hidden lg:block`)

**Arquivos alterados:**
- `supabase/functions/generate-blog-suggestions/index.ts`
- `supabase/functions/generate-multi-event-article/index.ts`
- `src/pages/EventDetail.tsx`

---

## ✅ Concluído Recentemente

### Cron Semanal de Limpeza Automática
**Status:** concluído  
**Descrição:** Agendamento pg_cron semanal (domingos 4h) para cleanup-storage (imagens órfãs) e cleanup_old_logs (logs >30d). Conversão WebP já implementada no client-side via ImageUploadWithCrop.  
**Data:** 11/02/2026  
**Responsável:** IA  
**Impacto:** alto  

---

### Otimização de Storage e Banco de Dados
**Status:** concluído  
**Descrição:** Criação de Edge Function cleanup-storage para identificar/deletar imagens órfãs e duplicadas, seção de Manutenção no SystemHealth com botões de limpeza, e execução de cleanup de dados antigos (analytics >90d, logs, reindex)  
**Data:** 11/02/2026  
**Responsável:** IA  
**Impacto:** alto  

**Alterações:**
- Edge Function `cleanup-storage` criada (scan dry-run + limpeza real)
- Seção "Manutenção e Otimização" no SystemHealth com 4 ferramentas: limpar imagens órfãs, converter PNGs para WebP, limpar logs antigos, limpar sync logs
- Dados antigos removidos: share_analytics >90d, newsletter_popup_analytics >90d, prompt_used >30d truncado
- Índice GIN do blog_posts reindexado para compactação
- config.toml atualizado com cleanup-storage

**Arquivos criados/alterados:**
- `supabase/functions/cleanup-storage/index.ts` (NOVO)
- `src/pages/admin/SystemHealth.tsx` (MODIFICADO)
- `supabase/config.toml` (MODIFICADO)

---

### Analytics de Eventos
**Status:** concluído  
**Descrição:** Nova seção colapsável em /admin/links-analytics mostrando ranking de eventos por views com link direto para cada evento  
**Data:** 04/02/2026  
**Responsável:** IA  
**Impacto:** médio  

**Alterações:**
- Novo card de resumo "Views em Eventos" na grade de métricas
- Seção colapsável "Analytics de Eventos" com top 20 eventos ordenados por views
- Exibe título, venue, data e percentual do total
- Dados já populados automaticamente (usa coluna `views` existente da tabela events)

**Arquivos alterados:**
- `src/pages/admin/LinksAnalytics.tsx`

---

### Filtro de Links Fake na Geração IA
**Status:** concluído  
**Descrição:** IA não inventará mais URLs de ingressos falsas. Pós-processamento remove links de domínios conhecidos como fake e system prompt condiciona seção de ingressos à existência de ticketLink real.  
**Data:** 04/02/2026  
**Responsável:** IA  
**Impacto:** alto  

**Alterações:**
1. Lista de domínios fake: ticketlink.com.br, ingressos.com.br, tickets.com.br, etc.
2. Função `removeFakeLinks()` remove links <a> e URLs plaintext desses domínios
3. System prompt dinâmico: se não houver ticketLink, instrui IA a NÃO incluir seção de ingressos
4. Validação de ticketLink real antes de permitir substituição de placeholders

**Arquivos alterados:**
- `supabase/functions/generate-blog-post-v2/index.ts`

---

### Auto-conversão WebP para Thumbnails de Links
**Status:** concluído  
**Descrição:** Thumbnails de links agora são automaticamente convertidas para WebP no upload, reduzindo tamanho em ~70%  
**Data:** 02/02/2026  
**Responsável:** IA  
**Impacto:** alto  

**Alterações:**
- Função `uploadThumbnail` em `CustomLinkForm.tsx` agora converte automaticamente para WebP após upload
- Usa a edge function `convert-to-webp` existente (bucket: `link-thumbnails`)
- Imagens WebP e SVG são mantidas sem conversão
- Fallback gracioso: se conversão falhar, usa imagem original

**Arquivos alterados:**
- `src/components/links/CustomLinkForm.tsx`

---

### Performance: Otimização Página /links para Mobile
**Status:** concluído  
**Descrição:** Otimização completa da página /links para melhorar carregamento em campanhas de tráfego mobile. Redução estimada de 50% no tempo de carregamento.  
**Data:** 02/02/2026  
**Responsável:** IA  
**Impacto:** alto  

**Alterações:**
1. **Skeleton Loading** - Novo componente `LinksSkeleton.tsx` exibe feedback visual instantâneo enquanto dados carregam
2. **StaticIcon** - Substituído `DynamicIcon` (lazy import por ícone) por mapa estático com ~30 ícones comuns, eliminando waterfall
3. **Lazy DnD** - Biblioteca @dnd-kit agora carrega apenas para admins via lazy import, reduzindo bundle para visitantes
4. **Imagens Lazy** - Adicionado `loading="lazy" decoding="async"` em todos os thumbnails dos cards
5. **Query Otimizada** - Select específico no useLinks ao invés de `SELECT *`, reduzindo payload ~50%
6. **Cache localStorage** - SiteSettingsContext usa cache local com revalidação em background
7. **Service Worker v5** - Cache específico para API de links com Stale-While-Revalidate

**Métricas Esperadas:**
- FCP: 2.5s → 1.2s (-52%)
- LCP: 4.5s → 2.0s (-56%)
- TTI: 5.0s → 2.5s (-50%)

**Arquivos criados:**
- `src/components/links/LinksSkeleton.tsx`
- `src/components/links/StaticIcon.tsx`
- `src/components/links/DndWrapper.tsx`

**Arquivos alterados:**
- `src/pages/Links.tsx`
- `src/components/links/SortableLinkCard.tsx`
- `src/hooks/useLinks.ts`
- `src/contexts/SiteSettingsContext.tsx`
- `public/service-worker.js`

---

## ✅ Concluído Recentemente

### UX Homepage e Blog: Layout Compacto
**Status:** concluído  
**Descrição:** 3 melhorias de UX implementadas: Hero reduzido para 85vh com espaçamentos compactos, filtros do blog atualizados com todas as categorias existentes, card de destaque reduzido ~30%  
**Data:** 29/01/2026  
**Responsável:** IA  
**Impacto:** alto  

**Alterações:**
1. **Hero** - Altura reduzida de `min-h-screen` para `min-h-[85vh]`, margens internas compactadas
2. **FeaturedEvents/LatestNews** - Padding reduzido de `py-20` para `py-12`
3. **Blog Categorias** - Adicionadas: Cultura, Lançamentos, Tecnologia, Produtores. Removidas: Guias, Entrevistas (0 posts)
4. **Card Destaque** - Imagem max h-64, título menor, excerpt 3 linhas, padding compacto

**Arquivos alterados:**
- `src/components/sections/Hero.tsx`
- `src/components/sections/FeaturedEvents.tsx`
- `src/components/sections/LatestNews.tsx`
- `src/pages/Blog.tsx`

---

## ✅ Concluído Recentemente

### Melhorias: Sitemap, Eventos Recorrentes e Sincronização de Imagem
**Status:** concluído  
**Descrição:** 3 melhorias implementadas: robots.txt com sitemap correto, campos adicionais no modal de eventos recorrentes, sincronização de imagem evento→links  
**Data:** 27/01/2026  
**Responsável:** Dev  
**Impacto:** médio  

**Alterações:**
1. **robots.txt** - Sitemap agora aponta para `https://www.mdaccula.com/sitemap.xml` (acessível pelo Google)
2. **Modal Eventos Recorrentes** - Adicionados campos: Subtítulo, Endereço, Descrição, Horário de Término
3. **Sincronização de Imagem** - Ao atualizar imagem de evento, `thumbnail_url` dos links vinculados é atualizado automaticamente

**Arquivos alterados:**
- `public/robots.txt`
- `src/pages/admin/RecurringEventsManager.tsx`
- `src/components/events/EventForm.tsx`

---

### Feature: Programa de Podcast Completo
**Status:** concluído  
**Descrição:** Sistema completo de inscrições para programa de podcast com página pública, dashboard admin e notificações automáticas  
**Data:** 23/01/2026  
**Responsável:** Dev  
**Impacto:** alto  

**Funcionalidades implementadas:**

1. **Tabela `podcast_submissions`** - Banco de dados com 15 campos incluindo dados pessoais, projeto musical e links sociais
2. **Edge Function `send-podcast-notification`** - Envia email de confirmação ao artista e notificação detalhada à agência
3. **Tipos TypeScript** - `PodcastSubmission`, `PodcastSubmissionInsert` e `PodcastSubmissionStatus` em `src/types/index.ts`
4. **Página Pública `/MDAcculaRadio`** - Landing page com:
   - Hero section com informações do programa
   - Seção "Como Funciona" com 3 passos
   - Seção "Divulgação" com benefícios
   - Cards de pricing/valor
   - Formulário validado com Zod (13+ campos)
   - Integração com Supabase e notificação automática
5. **Dashboard Admin `/admin/mdaccula-radio`** - Painel completo com:
   - Cards de métricas (total, pendentes, aprovados, taxa conversão)
   - Tabela com filtros por status e busca por texto
   - Dialog de detalhes com gerenciamento de status e notas admin
   - Exportação CSV
6. **Navegação** - Aba "MDAcculaRadio" com ícone Mic adicionada ao header

**Arquivos criados/alterados:**
- `supabase/functions/send-podcast-notification/index.ts` (criado)
- `src/types/index.ts` (atualizado)
- `src/pages/Podcast.tsx` (criado)
- `src/pages/admin/PodcastManager.tsx` (criado)
- `src/components/ui/navigation.tsx` (atualizado)
- `src/pages/Admin.tsx` (atualizado)
- `src/App.tsx` (atualizado)

---

## 📋 Índice

1. [Concluído Recentemente](#-concluído-recentemente)
2. [Pendências Ativas](#-pendências-ativas)
3. [Em Andamento](#-em-andamento)
4. [Concluídos](#-concluídos)
5. [Histórico de Mudanças](#-histórico-de-mudanças)
6. [Documentos Relacionados](#-documentos-relacionados)

---

### Correção: Template Default e Geração de Imagem
**Status:** concluído  
**Descrição:** Auditoria completa e correção de 5 problemas críticos que impediam geração de sugestões e artigos  
**Data:** 17/01/2026  
**Responsável:** Dev  
**Impacto:** crítico  

**Problemas identificados e corrigidos:**
1. **Timeout da IA insuficiente (50s → 90s)**: IA abortava antes de responder, agora tem 90 segundos
2. **Modelo incorreto (openai/gpt-5 → gemini-2.5-flash)**: Forçado uso do Gemini Flash via Lovable AI Gateway (mais rápido)
3. **Excesso de fontes scrapeadas (3 → 2)**: Reduzido para deixar mais tempo para IA
4. **Timeout externo menor que interno (120s → 150s)**: `auto-article-cron` agora espera 2.5 min por sugestões
5. **Fontes duplicadas no banco**: Removidas duplicatas de House Mag e Mix Mag Brasil

**Alterações técnicas:**
- `generate-blog-suggestions`: AI_TIMEOUT=90s, MAX_SOURCES=2, logs detalhados de tempo
- `auto-article-cron`: SUGGESTIONS_TIMEOUT=150s, logs de breakdown por etapa
- Banco: `ai_blog_model` → `google/gemini-2.5-flash`, `ai_auto_generate_fail_count` → 0
- Config.toml reescrito limpo sem funções fantasma

**Resultado esperado:**
- Sugestões geradas em < 60s
- Taxa de sucesso 95%+
- Logs claros para debug

---

### Refatoração Completa das Edge Functions de Geração de Artigos
**Status:** concluído  
**Descrição:** Refatoradas funções `generate-blog-suggestions` e `auto-article-cron` com timeouts adequados e removida função antiga `generate-blog-post`  
**Data:** 17/01/2026  
**Responsável:** Dev  
**Impacto:** alto  

**Problemas corrigidos:**
1. **Erro "slug: Invalid" no deploy**: Removida função `generate-blog-post` (antiga, não usada)
2. **Timeouts inadequados**: Scraping agora tem 12s por fonte, IA tem 50s
3. **Scraping sequencial lento**: Agora roda em paralelo com `Promise.all`
4. **Config.toml limpo**: Removidas entradas de funções inexistentes

**Alterações:**
- Deletado `supabase/functions/generate-blog-post/` (versão antiga)
- Refatorado `generate-blog-suggestions` com timeouts e scrape paralelo
- Refatorado `auto-article-cron` com timeouts de 2min (suggestions) e 3min (generate)
- Limpo `supabase/config.toml` sem funções fantasma

---

### Melhorias UX: Feedback Visual em Geração de Artigos
**Status:** concluído  
**Descrição:** Adicionado feedback visual para geração de múltiplos artigos e polling automático no dashboard  
**Data:** 17/01/2026  
**Responsável:** Dev  
**Impacto:** médio

**Melhorias implementadas:**
1. **Barra de progresso na geração em lote**: Mostra `X de Y` artigos sendo gerados
2. **Indicação visual por artigo**: 
   - Spinner no artigo sendo gerado
   - Badge verde (✓) para sucesso
   - Badge vermelho (✗) para falhas
3. **Toasts individuais**: Feedback para cada artigo (sucesso/erro) + resumo final
4. **Polling automático no Dashboard**: Atualiza a cada 10s enquanto geração está em andamento
5. **Timeout aumentado**: De 2min para 3min na edge function `auto-article-cron`
6. **Mensagem de feedback melhorada**: Usuário sabe que página atualiza automaticamente

**Arquivos alterados:**
- `src/pages/admin/AIContent2.tsx`
- `src/components/admin/ai-content/SuggestionsList.tsx`
- `src/pages/admin/AutoGenerationDashboard.tsx`
- `supabase/functions/auto-article-cron/index.ts`

---

### Dashboard de Monitoramento + Correção Sistema de Sugestões/Geração Automática
**Status:** concluído  
**Descrição:** Corrigido bug de sugestões (keywords como string) + cron job com background tasks + dashboard de monitoramento  
**Data:** 17/01/2026  
**Responsável:** Dev  
**Impacto:** alto  

**Problemas corrigidos:**
1. **Erro `s.keywords.map is not a function`**: A IA retornava `keywords` como string, mas o frontend esperava array
2. **Timeout do Cron Job**: Função síncrona demorava demais e era cancelada pelo scheduler

**Soluções:**
1. **Normalização de dados**: `AIContent2.tsx` agora converte strings para arrays ao receber sugestões
2. **Background Tasks**: `auto-article-cron` usa `EdgeRuntime.waitUntil` para executar em background
3. **Dashboard de Monitoramento**: Nova página `/admin/auto-generation` com:
   - Status atual (habilitado, intervalo, próxima execução)
   - Contador de falhas consecutivas com botão de reset
   - Último artigo gerado automaticamente
   - Histórico de 15 execuções com detalhes
   - Botão "Forçar Geração Agora"
   - Toggle habilitar/desabilitar

**Arquivos alterados:**
- `src/pages/admin/AIContent2.tsx`
- `src/components/admin/ai-content/SuggestionsList.tsx`
- `supabase/functions/auto-article-cron/index.ts`
- `src/pages/admin/AutoGenerationDashboard.tsx` (novo)
- `src/pages/Admin.tsx`
- `src/App.tsx`

---

### Bug Crítico: Geração Automática de Artigos Falhando Silenciosamente
**Status:** concluído  
**Descrição:** Sistema atualizava `last_run` ANTES de gerar artigo, causando falhas silenciosas (só 1 artigo em 5 dias)  
**Data:** 17/01/2026  
**Responsável:** Dev  
**Impacto:** alto  

**Problema:** O `ai_auto_generate_last_run` era atualizado ANTES de tentar gerar o artigo. Se a geração falhasse (timeout, erro API), o sistema achava que gerou e aguardava 48h para tentar novamente.

**Solução:**
1. Movido `last_run` para APÓS sucesso confirmado (post.id existe)
2. Adicionado retry automático: 1h após falha (não 48h)
3. Contador de falhas consecutivas (`ai_auto_generate_fail_count`)
4. Pausa automática após 5 falhas (24h de cooldown)
5. Logging de todos os erros em `application_logs`
6. Reset do `last_run` para forçar nova tentativa imediata

---

### Template Multi-Eventos no Editor de Prompts
**Status:** concluído  
**Descrição:** Prompt de artigo multi-eventos agora editável via admin + melhorias no conteúdo gerado  
**Data:** 15/01/2026  
**Responsável:** Dev  
**Impacto:** alto

**Alterações:**
1. **Novo Template** - Categoria "Multi-Eventos" inserida em `ai_prompt_templates`
2. **Edge Function Atualizada** - `generate-multi-event-article` agora busca template do banco (com fallback)
3. **Prompt Melhorado**:
   - Introdução extensa (3-4 parágrafos) sobre label/produtora e local
   - Cada data com 5-6 linhas detalhando artistas principais
   - Contexto dos headliners (origem, releases, trajetória)
   - Artigo 1500-2500 palavras

---

### Gerador de Artigo Multi-Datas
**Status:** concluído  
**Descrição:** Novo recurso para gerar artigo consolidado de múltiplos eventos da mesma série/temporada  
**Data:** 15/01/2026  
**Responsável:** Dev  
**Impacto:** alto  

**Alterações:**
1. **Modal de Seleção** - `src/components/admin/MultiEventArticleModal.tsx` com busca, multi-seleção e preview
2. **Edge Function** - `supabase/functions/generate-multi-event-article/index.ts` com prompt especializado para séries de eventos
3. **Botão no EventsManager** - "Artigo Multi-Datas" no header da página
4. **Vinculação Automática** - Todos eventos selecionados são vinculados ao blog post gerado
5. **Prompt Otimizado** - Gera artigo extenso (1500-2500 palavras) com seções por data, lineups e links de ingressos

---


### Virtualização + Bundle Optimization + Logger Persistência
**Status:** concluído  
**Descrição:** Implementados 3 itens de otimização: virtualização de listas, bundle optimization e persistência de logs  
**Data:** 15/01/2026  
**Responsável:** Dev  
**Impacto:** médio  

**Alterações:**
1. **Virtualização LinksManager** - Componente VirtualizedLinkList com @tanstack/react-virtual (ativo para >20 itens)
2. **Bundle Optimization** - vite.config.ts com LightningCSS, múltiplos passes de compressão, chunks separados para DnD e Virtual
3. **Logger Persistência** - Edge function `persist-logs` + tabelas `application_logs` e `performance_metrics` + cleanup automático 30 dias

---

### Debounce nos Filtros da Página Eventos
**Status:** concluído  
**Descrição:** Implementado debounce nos inputs de filtro da página Eventos  
**Data:** 14/01/2026  
**Responsável:** Dev  
**Impacto:** médio  

**Alterações:**
- Criado hook reutilizável `useDebouncedValue` em `src/hooks/useDebouncedValue.ts`
- Aplicado debounce de 300ms no campo de busca (`searchTerm`)
- Aplicado debounce de 300ms no filtro de cidade (`cityFilter`)
- Selects (gênero, estado) mantêm resposta imediata (não precisam debounce)
- Hook exportado no barrel `src/hooks/index.ts`
- SearchBar refatorado para usar o hook centralizado

---

### Performance: Sourcemaps + Debounce + Prefetch
**Status:** concluído  
**Descrição:** Implementados 3 itens de otimização de performance  
**Data:** 14/01/2026  
**Responsável:** Dev  
**Impacto:** médio  

**Alterações:**
1. **Sourcemaps Hidden** - `vite.config.ts` agora usa `sourcemap: 'hidden'` em produção
2. **Debounce SearchBar** - Adicionado debounce de 300ms na busca com hook customizado
3. **Prefetch Rotas** - Já estava implementado no navigation.tsx (onMouseEnter/onFocus)

---

### Sitemap Acessível para Google Search Console
**Status:** concluído  
**Descrição:** Configurado sitemap.xml estático + robots.txt com URL correta da Edge Function  
**Data:** 14/01/2026  
**Responsável:** Dev  
**Impacto:** alto (SEO)  

**Alterações:**
- Criado `public/sitemap.xml` com páginas estáticas principais
- Atualizado `robots.txt` com URL completa da Edge Function do Supabase
- Edge Function continua gerando sitemap dinâmico com posts e eventos
- Google Search Console pode indexar via `/sitemap.xml` ou URL da Edge Function

---

### OptimizedImage com srcset Responsivo
**Status:** concluído  
**Descrição:** Melhorado componente OptimizedImage com srcset para imagens responsivas  
**Data:** 13/01/2026  
**Responsável:** Dev  
**Impacto:** médio  

**Alterações:**
- Adicionado suporte a `srcset` para imagens responsivas
- Detecção automática de URLs do Supabase Storage (suporte a transformações)
- Props configuráveis: `sizes` e `widths` para customização
- Breakpoints padrão: 320, 640, 768, 1024, 1280, 1920px
- `sizes` padrão inteligente para diferentes viewports
- Imagens externas mantêm comportamento original (fallback gracioso)

---

### Service Worker Stale While Revalidate
**Status:** concluído  
**Descrição:** Melhorado cache strategy do Service Worker com Stale While Revalidate  
**Data:** 13/01/2026  
**Responsável:** Dev  
**Impacto:** médio  

**Alterações:**
- Atualizado para v4 com 3 caches separados (static, dynamic, images)
- Cache First para fontes e assets bundled (30 dias)
- Stale While Revalidate para imagens (retorno rápido + atualização em background)
- Network First para HTML (sempre fresco com fallback)
- Adicionado comando CLEAR_CACHE para limpeza manual
- Melhor separação de responsabilidades por tipo de recurso

---

### Skeleton Loading Blog
**Status:** concluído  
**Descrição:** Adicionado skeleton loading na página Blog para melhor UX durante carregamento  
**Data:** 13/01/2026  
**Responsável:** Dev  
**Impacto:** médio  

**Alterações:**
- Criado componente `BlogCardSkeleton` para cards individuais
- Criado componente `BlogGridSkeleton` para grid de 6 cards
- Adicionado skeleton para seção de destaque (featured post)
- Substituído texto "Carregando posts..." por skeletons visuais

---

### Migração Eventos para React Query
**Status:** concluído  
**Descrição:** Migrada página /eventos de useState+useEffect para React Query com cache  
**Data:** 12/01/2026  
**Responsável:** Dev  
**Impacto:** médio  

**Alterações:**
- Criado hook `src/hooks/useEvents.ts` com React Query
- Cache de 5 minutos (staleTime) para evitar refetch desnecessário
- Garbage collection de 10 minutos (gcTime)
- Refatorado `Eventos.tsx` para usar o novo hook
- Removida lógica duplicada de fetch manual

### Lazy Loading EventsCarousel
**Status:** concluído  
**Descrição:** Adicionado lazy loading nas imagens do carousel de eventos  
**Data:** 12/01/2026  
**Responsável:** Dev  
**Impacto:** médio  

**Alterações:**
- Criado componente `LazyEventImage` com loading="lazy" e decoding="async"
- Substituído `backgroundImage` CSS por `<img>` com lazy loading nativo
- Adicionado placeholder gradient enquanto imagem carrega
- Transição suave de opacidade ao carregar
- Tratamento de erro com fallback para gradient

---

### Consolidação Queries Blog
**Status:** concluído  
**Descrição:** Unificadas 2 queries separadas (featured + lista) em uma única query otimizada  
**Data:** 12/01/2026  
**Responsável:** Dev  
**Impacto:** médio  

**Alterações:**
- Removida função `fetchFeaturedPost` separada
- Criada função única `fetchBlogPostsWithFeatured`
- Página 1 busca PAGE_SIZE + 1 e usa primeiro post como destaque
- Reduziu de 2 requisições para 1 por carregamento de página

---

### Índice Composto Events
**Status:** concluído  
**Descrição:** Criado índice composto para otimizar filtros por data e localização na página de eventos  
**Data:** 13/01/2026  
**Responsável:** Dev  
**Impacto:** médio  

**Alterações:**
- Criado índice `idx_events_date_location` em (date, location_state, location_city)
- Melhora performance de queries com filtros combinados
- Beneficia página /eventos com filtros de estado/cidade

---

### SiteSettingsProvider Global
**Status:** concluído  
**Descrição:** Criado provider global para eliminar queries duplicadas de site_settings  
**Data:** 11/01/2026  
**Responsável:** Dev  
**Impacto:** médio  

**Alterações:**
- Criado `src/contexts/SiteSettingsContext.tsx` com provider e context
- Refatorado `useSiteSettings` para re-exportar do context (compatibilidade)
- Adicionado `SiteSettingsProvider` no `App.tsx` 
- Refatorado `NewsletterPopup` para usar o hook ao invés de query direta
- Reduzido de 5-6 queries por página para 1 única query global

---

### Correção de Policy RLS Permissiva
**Status:** concluído  
**Descrição:** Corrigida policy permissiva em newsletter_subscribers que usava WITH CHECK (true)  
**Data:** 11/01/2026  
**Responsável:** Dev  
**Impacto:** alto  

**Alterações:**
- Criada função `is_valid_email()` para validação de formato
- Nova policy com validação de email + tamanho máximo + source obrigatório
- Constraint de unicidade adicionado na coluna email

---

### Atualização Completa da Documentação Técnica
**Status:** concluído  
**Descrição:** Atualização de todos os documentos técnicos com as funcionalidades mais recentes  
**Data:** 10/01/2026  
**Responsável:** Sistema  
**Impacto:** médio  

**Documentos atualizados:**
- README.md - Stack, tabelas, edge functions
- docs/PRD.md - Backlog e funcionalidades
- docs/ROADMAP.md - Fases e status atuais
- PENDENCIAS.MD - Histórico e pendências
- docs/CODE_STYLE.md - Revisão geral
- docs/SECURITY-AUDIT.md - Revisão geral

---

### Cron Job para Eventos Recorrentes D.EDGE
**Status:** concluído  
**Descrição:** Sistema automatizado para criar eventos semanais do D.EDGE (Moving, FreakChic, Nave, SuperAfter)  
**Data:** 09/01/2026  
**Responsável:** Dev  
**Impacto:** alto  

**Funcionalidades:**
- Tabela `recurring_event_configs` para configurar eventos recorrentes
- Edge function `create-recurring-events` executada toda terça às 03:00 BRT
- Cálculo automático da próxima data baseado no weekday configurado
- Verificação de duplicatas por título + data
- Página admin `/admin/recurring-events` para gerenciar configurações
- Botão "Executar Agora" para testes manuais
- Toggle enable/disable para cada evento

---

### Carousel de Eventos Mobile
**Status:** concluído  
**Descrição:** Cards horizontais deslizantes para próximos eventos em mobile  
**Data:** 09/01/2026  
**Responsável:** Dev  
**Impacto:** médio  

**Funcionalidades:**
- Componente `EventsCarousel` usando Embla Carousel
- Visível apenas em mobile (md:hidden)
- Mostra até 6 próximos eventos
- Design com imagem de fundo, data badge, gênero e informações
- Navegação ao clicar no card

---

### Preview do Prompt de Imagem no AISettings
**Status:** concluído  
**Descrição:** Adicionado botão de preview que mostra como o prompt fica com dados de exemplo preenchidos  
**Data:** 07/01/2026  
**Responsável:** Dev  
**Impacto:** baixo  

**Funcionalidades:**
- Botão "Preview" que abre modal com prompt renderizado
- Dados de exemplo realistas (Vintage Culture, turnê 2026)
- Botão "Restaurar Padrão" para voltar ao prompt original
- Visualização clara de todas as variáveis substituídas

---

### Melhoria do Prompt de Imagem Nano Banana
**Status:** concluído  
**Descrição:** Aprimoramento do sistema de geração de imagens para artigos automáticos e sugestões  
**Data:** 07/01/2026  
**Responsável:** Dev  
**Impacto:** alto  

**Variáveis disponíveis para prompt de imagem:**
| Variável | Descrição |
|----------|-----------|
| `{{title}}` | Título do artigo |
| `{{summary}}` | Resumo/excerpt |
| `{{category}}` | Categoria (Eventos, Produtores, etc) |
| `{{keywords}}` | Palavras-chave extraídas |
| `{{mood}}` | Atmosfera visual (energético, underground, etc) |
| `{{visualElements}}` | Elementos visuais sugeridos |

---

### Reorganização Admin.tsx em Seções
**Status:** concluído  
**Descrição:** Agrupamento dos cards do painel admin em 4 seções visuais com headers  
**Data:** 07/01/2026  
**Responsável:** Dev  
**Impacto:** médio  

**Seções criadas:**
1. **Conteúdo** (6 cards): Blog, Eventos, IA Content, Prompts, Fontes de Notícias, Eventos Recorrentes
2. **Links & Newsletter** (4 cards): Links, Analytics, Newsletter, A/B Testing
3. **Sistema** (5 cards): Configurações, Backup, Status, Dashboard, Templates
4. **Equipe** (1 card): Gerenciar Equipe

---

## 🔴 Pendências Ativas

### Melhorias Planejadas



#### Bundle Optimization
**Status:** pendente  
**Descrição:** Otimizar bundle size para melhor performance de carregamento  
**Data:** 06/01/2026  
**Responsável:** Dev  
**Impacto:** médio  

---

## 🟡 Em Andamento

*(Nenhum item em andamento no momento)*

---

## ✅ Concluídos

### Janeiro 2026

| Data | Tipo | Descrição |
|------|------|-----------|
| 10/01 | Docs | Atualização completa de documentação técnica |
| 09/01 | Feature | Cron job para eventos recorrentes D.EDGE |
| 09/01 | Feature | Carousel de eventos mobile |
| 07/01 | Feature | Prompt de imagem aprimorado (6 variáveis) |
| 07/01 | Feature | Preview do prompt de imagem no AISettings |
| 07/01 | Refactor | Reorganização Admin.tsx em seções |
| 07/01 | Refactor | AIContent2.tsx em Tabs |
| 07/01 | Bugfix | Correção global de timezone em eventos |
| 07/01 | Feature | Auditoria e correção de slugs |
| 07/01 | Bugfix | Correção de edição de posts e botão regenerar |
| 06/01 | Feature | Documentação técnica (PRD, ROADMAP) |
| 06/01 | Bugfix | Correção auto-geração de artigos |
| 06/01 | Feature | Regeneração de imagem com IA no Blog Manager |
| 06/01 | Feature | Logging centralizado |
| 06/01 | Feature | Error Boundaries em todas as páginas |
| 06/01 | Feature | Dashboard de saúde do sistema |
| 06/01 | Feature | CI/CD Pipeline GitHub Actions |
| 06/01 | Bugfix | Correção crash página Index |
| 06/01 | Security | Vulnerabilidades RLS corrigidas |
| 06/01 | Security | Rate limiting em edge functions |
| 05/01 | Feature | Ordenação manual de links |

### Dezembro 2025

| Data | Tipo | Descrição |
|------|------|-----------|
| Dez | Feature | MVP completo lançado |
| Dez | Feature | Sistema de IA para blog |
| Dez | Feature | Newsletter com A/B testing |
| Dez | Feature | Página de links (Linktree-style) |
| Dez | Feature | Painel administrativo |

---

## 📜 Histórico de Mudanças

### 2026

| Data | Tipo | Descrição |
|------|------|-----------|
| 10/01 | Docs | Atualização completa documentação técnica |
| 09/01 | Feature | Cron job eventos recorrentes D.EDGE |
| 09/01 | Feature | Carousel de eventos mobile |
| 07/01 | Feature | Prompt de imagem aprimorado |
| 06/01 | Feature | Documentação técnica completa (PRD, ROADMAP) |
| 06/01 | Bugfix | Correção auto-geração de artigos |
| 06/01 | Feature | Logging centralizado |
| 06/01 | Feature | Error Boundaries em todas as páginas |
| 06/01 | Feature | CI/CD Pipeline GitHub Actions |
| 06/01 | Bugfix | Correção crash página Index |
| 06/01 | Security | Vulnerabilidades RLS corrigidas |
| 06/01 | Security | Rate limiting em edge functions |
| 05/01 | Feature | Ordenação manual de links |

### 2025

| Data | Tipo | Descrição |
|------|------|-----------|
| Dez | Feature | MVP completo lançado |
| Dez | Feature | Sistema de IA para blog |
| Dez | Feature | Newsletter com A/B testing |
| Dez | Feature | Página de links (Linktree-style) |
| Dez | Feature | Painel administrativo |

---

## 📊 Resumo

| Status | Quantidade |
|--------|------------|
| 🔴 Pendente | 4 |
| 🟡 Em andamento | 0 |
| ✅ Concluído | 25+ |

---

## 📚 Documentos Relacionados

| Documento | Descrição | Link |
|-----------|-----------|------|
| README.md | Documentação técnica | [/README.md](/README.md) |
| PRD.md | Requisitos do produto | [/docs/PRD.md](/docs/PRD.md) |
| ROADMAP.md | Fases e cronograma | [/docs/ROADMAP.md](/docs/ROADMAP.md) |
| CODE_STYLE.md | Guia de código | [/docs/CODE_STYLE.md](/docs/CODE_STYLE.md) |
| SECURITY-AUDIT.md | Auditoria segurança | [/docs/SECURITY-AUDIT.md](/docs/SECURITY-AUDIT.md) |
| tabelas.md | Documentação do banco | [/tabelas.md](/tabelas.md) |

---

*Este documento é atualizado automaticamente pelo sistema. Sempre registre alterações aqui.*
