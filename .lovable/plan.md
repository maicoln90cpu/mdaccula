

## Auditoria: Por que o Cached Egress do Supabase está alto (8.45 GB)

### Fontes de Egress Identificadas

**1. Service Worker faz "Stale While Revalidate" em TODAS as APIs do Supabase**
O Service Worker (linhas 150-154) cacheia e RE-BUSCA em background todas as chamadas para:
- `/rest/v1/link_groups` (com joins pesados — eventos, links, thumbnails)
- `/rest/v1/site_settings` (30+ chaves)
- `/rest/v1/blog_posts`
- `/rest/v1/events` (payloads grandes com lineup, links, etc.)

A estratégia "Stale While Revalidate" serve do cache MAS **sempre refaz a request em background**. Ou seja, cada visita de cada usuário gera uma chamada API ao Supabase mesmo que tenha cache. Com 7.636 requests no Bunny, o site tem tráfego significativo — cada pageview dispara 4+ requests ao Supabase.

**2. Avatar URL ainda aponta para Supabase Storage**
No `site_settings`, a chave `links_page_avatar_url` está com:
`https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public/link-thumbnails/avatar-1772043247039.webp`

Apesar do `getOptimizedImageUrl()` reescrever para Bunny CDN no front-end, essa reescrita só funciona no navegador. Bots, crawlers, previews (og:image), e qualquer acesso direto ao campo no banco usam a URL original do Supabase.

**3. Fallback CDN→Supabase durante a instabilidade do Bunny (17 Mar)**
O pico de 3.327 GB no dia 17/Mar coincide com os problemas do Bunny CDN que você reportou. Quando o Bunny falhava, o `handleImageFallback` e `OptimizedImage` automaticamente carregavam cada imagem do Supabase Storage. Com dezenas de imagens por página e alto tráfego, isso gerou GBs de egress.

**4. API responses são pesados**
O endpoint `/rest/v1/events` retorna campos como `lineup` (arrays grandes com emojis e nomes), `description`, `vip_link` (URLs longas com WhatsApp). Cada response tem ~5-10 KB. Multiplicado por milhares de requests = egress significativo.

### Distribuição Estimada do Egress

| Fonte | Impacto |
|-------|---------|
| Fallback CDN→Supabase em 17/Mar | ~3-4 GB (pico pontual) |
| API REST (stale-while-revalidate) | ~2-3 GB (contínuo) |
| Avatar via Supabase Storage | ~0.5-1 GB |
| Edge Functions (upload backup, etc.) | ~0.1 GB |

### Plano de Correção

**A. Migrar avatar para Bunny CDN**
- Atualizar o valor de `links_page_avatar_url` no banco para apontar para `mdaccula.b-cdn.net`
- Migração SQL: `UPDATE site_settings SET value = REPLACE(value, 'xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public', 'mdaccula.b-cdn.net') WHERE value LIKE '%supabase.co/storage/v1/object/public%'`

**B. Otimizar Service Worker — trocar Stale While Revalidate por Cache First com TTL para APIs**
- Mudar `site_settings` para Cache First com TTL de 15 min (quase nunca muda)
- Mudar `events` e `blog_posts` para Cache First com TTL de 5 min
- Apenas `link_groups` pode ficar com Stale While Revalidate (muda com mais frequência)

**C. Remover fallback Supabase enquanto Bunny funciona (opcional)**
- Manter o fallback no código mas só ativá-lo após verificar se o Bunny está realmente fora
- Alternativa: adicionar um health-check rápido antes de tentar Supabase

**D. Reduzir payload das APIs**
- Selecionar apenas campos necessários no frontend (ex: remover `description` da listagem de eventos, só buscar quando abrir detalhe)

### Arquivos a alterar

1. `public/service-worker.js` — otimizar estratégia de cache das APIs
2. Migração SQL — migrar URLs restantes do Supabase Storage para Bunny no banco
3. `src/hooks/useEvents.ts` — remover `description` da query de listagem (campo pesado)

