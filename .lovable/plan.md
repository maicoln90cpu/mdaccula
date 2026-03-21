
Objetivo: atacar 2 frentes em paralelo — reduzir o cached egress diário do Supabase e corrigir definitivamente o bug do redirecionamento.

Diagnóstico confirmado

1. O egress alto não vem mais principalmente de imagens
- O gráfico de cached egress do Supabase inclui API, Storage e Edge Functions.
- Hoje as imagens principais já estão em Bunny, mas o frontend ainda faz várias chamadas REST ao Supabase por visita.

2. Há requests redundantes para site_settings
- O log de rede mostra pelo menos 2 requests para `site_settings` na home:
  - `select=key,value`
  - `select=value&key=eq.google_tag_manager_id`
- Além disso, `src/contexts/SiteSettingsContext.tsx` faz um “background refresh” sempre que existe cache local. Ou seja: mesmo com cache em localStorage, ele ainda bate no Supabase.
- `src/components/GoogleTagManager.tsx` busca o GTM novamente em vez de reutilizar o contexto já carregado.

3. A home ainda tem múltiplas queries independentes por pageview
- `FeaturedEvents.tsx` faz query própria em `events`
- `LatestNews.tsx` faz query própria em `blog_posts`
- `SiteSettingsContext.tsx` faz query em `site_settings`
- Isso explica por que ainda existe consumo diário, mesmo sem usar Supabase Storage para imagem.

4. O redirecionamento está quebrado por URL sem protocolo
- No banco, o slug `lista_DEDGE_email` está salvo como:
  `postcontrol.com.br/mdaccula/lista/dedge`
- Em `src/pages/Redirect.tsx`, `new URL(data.destination_url)` falha sem `https://`.
- O catch mantém o valor cru e `window.location.replace("postcontrol.com.br/...")` vira rota relativa:
  `https://mdaccula.com/r/postcontrol.com.br/...`
- Portanto o erro não é do navegador nem do router: é dado inválido + ausência de normalização.

Plano de implementação

A. Reduzir mais o cached egress do Supabase
1. Eliminar refresh redundante de `site_settings`
- Arquivo: `src/contexts/SiteSettingsContext.tsx`
- Remover o fetch em background quando já houver cache local válido.
- Deixar o React Query decidir quando refetchar, sem disparo manual paralelo.

2. Parar a segunda chamada de GTM
- Arquivo: `src/components/GoogleTagManager.tsx`
- Trocar a query direta ao Supabase por leitura de `useSiteSettings()`.
- Resultado: 1 request a menos por visita.

3. Endurecer cache de React Query nas queries públicas da home
- Arquivos:
  - `src/components/sections/FeaturedEvents.tsx`
  - `src/components/sections/LatestNews.tsx`
  - possivelmente `src/hooks/useEvents.ts`
- Ajustes:
  - `staleTime` maior para dados públicos
  - `refetchOnWindowFocus: false`
  - `refetchOnReconnect: false` onde fizer sentido
  - manter atualização manual ou por navegação normal, sem re-fetch agressivo

4. Revisar se o Service Worker está realmente cobrindo o publicado
- Arquivo: `public/service-worker.js`
- Subir versão do cache para invalidar SW antigo caso necessário.
- Garantir que as rotas REST públicas continuem em `cacheFirstWithTTL`.

Impacto esperado:
- corta requests duplicados de `site_settings`
- reduz re-fetch em foco/reconexão
- diminui o volume diário de respostas cacheadas servidas pelo Supabase

B. Corrigir o bug do redirecionamento
1. Normalizar URL no redirect runtime
- Arquivo: `src/pages/Redirect.tsx`
- Criar lógica:
  - trim
  - remover prefixos lixo como `→ `
  - se não começar com `http://` ou `https://`, prefixar `https://`
- Só depois aplicar UTM e chamar `window.location.replace()`.

2. Validar/sanitizar URL no admin
- Arquivo: `src/pages/admin/RedirectsManager.tsx`
- Ao salvar:
  - aplicar a mesma normalização
  - impedir persistência de URLs sem protocolo bruto
- Opcional: mostrar preview final da URL normalizada antes de salvar.

3. Corrigir registros já salvos no banco
- Criar migração SQL para:
  - prefixar `https://` onde faltar
  - remover valores iniciando com `→ `
- Isso corrige `lista_DEDGE_email` e outros slugs antigos.

C. Resultado esperado
1. Cached egress diário cai porque:
- sai o background refresh desnecessário
- sai a query extra de GTM
- diminuem re-fetches automáticos da home

2. Redirecionamentos passam a abrir o destino correto mesmo para dados antigos
- Exemplo:
  `/r/lista_DEDGE_email`
  deixa de ir para
  `mdaccula.com/r/postcontrol.com.br/...`
  e passa a ir para
  `https://postcontrol.com.br/mdaccula/lista/dedge`

Arquivos a alterar
- `src/contexts/SiteSettingsContext.tsx`
- `src/components/GoogleTagManager.tsx`
- `src/components/sections/FeaturedEvents.tsx`
- `src/components/sections/LatestNews.tsx`
- `src/pages/Redirect.tsx`
- `src/pages/admin/RedirectsManager.tsx`
- nova migração SQL para saneamento de `redirect_links.destination_url`

Observação técnica importante
- Mesmo com zero imagens no Supabase Storage, o cached egress não vai a “quase zero” se a aplicação continuar consultando APIs públicas do Supabase em toda visita. O que falta reduzir agora é o tráfego REST, não o Storage.
