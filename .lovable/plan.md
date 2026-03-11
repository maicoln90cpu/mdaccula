
Objetivo: descobrir por que “sumiu tudo” mesmo com Bunny CDN e definir correção completa.

1) O que foi descoberto (raiz do problema)
- O conteúdo não foi apagado do banco: existem dados (ex.: 22 grupos de links, 199 links, 126 posts, 159 eventos).
- O projeto Supabase está bloqueado por quota (`exceed_cached_egress_quota`), então:
  - REST (`/rest/v1/...`) retorna 402
  - Edge Functions retornam 402
  - Parte das imagens via CDN também retorna 402 quando não está em cache quente.
- Bunny CDN cacheia arquivos de imagem, mas a UI depende primeiro dos dados do banco (links, posts, eventos). Sem JSON da API, não há “o que renderizar”.
- Há um problema adicional “por baixo”: o Service Worker foi configurado para cachear `link_groups/site_settings`, mas o `shouldBypassCache()` bloqueia todos requests externos antes dessa regra. Na prática, esse cache de API nunca entra em ação.

2) Plano de correção (ordem recomendada)
Fase A — Recuperação imediata (incidente)
- Abrir chamado no Supabase para desbloquear o projeto (sem isso, nenhum endpoint público volta).
- Validar retorno 200 em:
  - `/rest/v1/site_settings`
  - `/rest/v1/link_groups`
  - `/functions/v1/blog-rss`
  - imagens no `cdn.mdaccula.com`.

Fase B — Reduzir egress novamente (hotfix)
- Reverter parâmetros de imagem para reaproveitar cache antigo e reduzir misses:
  - `src/lib/imageUtils.ts`: voltar qualidade padrão para 75.
  - `src/components/links/LinkCardImage.tsx`: usar `getThumbnailUrl(..., 256)` para cards pequenos.
  - `src/pages/Blog.tsx` e `src/components/sections/LatestNews.tsx`: usar thumbnail com largura limitada (ex.: 400) em listagens.

Fase C — Resiliência quando Supabase cair/bloquear
- Implementar fallback persistente de dados (stale cache local) para páginas públicas:
  - `useLinks`, `useEvents`, `Blog` (query function) e `SiteSettingsContext`.
  - Salvar último payload válido em localStorage (com timestamp/TTL).
  - Em erro 402/offline: renderizar snapshot + banner “modo contingência”.
- Trocar empty-state enganoso:
  - Em `/links`, se erro de backend, mostrar “serviço temporariamente indisponível” em vez de “Nenhum link disponível”.

Fase D — Corrigir Service Worker (bug estrutural)
- `public/service-worker.js`:
  - Mover regra de cache dos endpoints Supabase para antes do bypass global, ou criar allowlist explícita para `site_settings`, `link_groups`, `blog_posts`, `events`.
  - Continuar sem cache para auth/sensível.
  - Garantir cache apenas de respostas 200.
- Resultado esperado: em nova indisponibilidade, visitantes ainda veem último estado conhecido.

3) Arquivos que serão alterados
- `src/lib/imageUtils.ts`
- `src/components/links/LinkCardImage.tsx`
- `src/pages/Blog.tsx`
- `src/components/sections/LatestNews.tsx`
- `src/hooks/useLinks.ts`
- `src/hooks/useEvents.ts`
- `src/contexts/SiteSettingsContext.tsx`
- `public/service-worker.js`
- `src/pages/Links.tsx` (tratamento de erro/estado de contingência)

4) Critérios de aceite
- Com Supabase normal: conteúdo carrega e imagens servem via CDN sem explosão de egress.
- Com Supabase forçando 402: `/links`, `/blog`, home continuam exibindo snapshot local + aviso de contingência.
- Empty state não confunde mais indisponibilidade com ausência real de conteúdo.
