

## Plano: Corrigir URL residual em site_settings

### Situação atual

As imagens do site publicado estao carregando corretamente -- verifiquei via screenshot as paginas `/`, `/blog` e `/eventos`. Todas as URLs nas tabelas `events`, `blog_posts` e `custom_links` ja apontam para `mdaccula.b-cdn.net` (0 URLs residuais no Supabase).

O unico problema restante: a tabela `site_settings` tem 1 URL ainda no Supabase:
- `links_page_avatar_url` → `https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public/link-thumbnails/avatar-1772043247039.webp`

Isso acontece porque `site_settings` nao esta na lista `URL_COLUMNS` do `migrate-to-bunny`, entao o `update_urls` nunca a atualiza.

### Correção

**A. Adicionar `site_settings` ao `update_urls`** no `migrate-to-bunny/index.ts`:
- Após processar as tabelas do `URL_COLUMNS`, buscar `site_settings` onde `value LIKE '%supabase.co/storage%'` e reescrever para Bunny CDN
- Isso cobre o avatar e qualquer futuro valor com URL de imagem

**B. Adicionar `site_settings` ao `diagnose`**:
- Incluir contagem de URLs do Supabase em `site_settings` no diagnostico

### Arquivos alterados
- `supabase/functions/migrate-to-bunny/index.ts` -- adicionar site_settings ao update_urls e diagnose

