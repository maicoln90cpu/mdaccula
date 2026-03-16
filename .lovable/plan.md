
Problema identificado: o Cloudflare não parece ser a causa principal. O app está usando `https://mdaccula.b-cdn.net/...` diretamente, e tanto o HTML do preview quanto o do publicado já saem com URLs do Bunny. Ou seja: o banco e o render estão corretos, mas o navegador está falhando ao carregar/decodificar várias imagens e então o front cai no fallback local `dj-performance`.

O que encontrei no código:
1. `src/pages/Eventos.tsx` e `src/pages/Blog.tsx` ainda fazem fallback explícito para `dj-performance.jpg` via `onError`, então qualquer falha de imagem vira exatamente a imagem genérica que você está vendo.
2. O HTML publicado de `/eventos` já contém URLs Bunny corretas, então o problema não é “URL ainda no Supabase”.
3. Há forte indício de arquivo inválido/inconsistente no Bunny:
   - `generate-blog-post-v2` faz conversão para WebP, mas se a conversão falha ele usa `pngBuffer` e mesmo assim salva com nome `.webp` e header `image/webp`.
   - `generate-multi-event-article` salva `pngBuffer` com nome `.webp` e header `image/webp`.
   - `regenerate-blog-image` pega bytes base64 crus e salva como `.webp` com `image/webp` sem garantir que os bytes sejam realmente WebP.
   - `batch-convert-webp` migra “as-is”; então arquivos antigos podem continuar JPEG/PNG, e alguns uploads mais novos podem estar com extensão/header dizendo WebP sem serem WebP de verdade.
4. Isso explica perfeitamente o comportamento:
   - no banco a URL parece certa;
   - no Bunny o arquivo “existe”;
   - mas o navegador falha ao decodificar;
   - o componente dispara `onError` e troca para `dj-performance`.

Por que a análise anterior parecia mostrar imagens corretas:
- O scraper/HTML conseguiu ler a página e enxergar as URLs.
- Mas screenshots de página não garantem que o navegador real conseguiu decodificar cada imagem.
- Inclusive o screenshot direto de um arquivo Bunny ficou branco/timeout, reforçando que há problema no asset, não na query do banco.

Plano de correção:
1. Corrigir geração/upload de imagens de IA para garantir consistência binária:
   - `supabase/functions/generate-blog-post-v2/index.ts`
   - `supabase/functions/generate-multi-event-article/index.ts`
   - `supabase/functions/regenerate-blog-image/index.ts`
   Regras:
   - só usar extensão `.webp` e `Content-Type: image/webp` quando os bytes forem realmente WebP;
   - se a conversão falhar, salvar como `.png`/`.jpeg` com content-type real;
   - idealmente centralizar isso numa função utilitária compartilhada.

2. Corrigir uploads/migração genérica:
   - revisar `supabase/functions/upload-to-bunny/index.ts`
   - revisar `supabase/functions/batch-convert-webp/index.ts`
   Regras:
   - preservar extensão e MIME reais do arquivo recebido;
   - evitar `application/octet-stream` para imagens quando houver tipo conhecido;
   - se o objetivo for “converter”, então converter de verdade; se for “migrar”, manter nome/tipo corretos.

3. Criar diagnóstico de integridade de mídia no painel:
   - para uma amostra ou todos os arquivos, validar:
     - extensão
     - content-type
     - assinatura real do arquivo (magic bytes: WebP/PNG/JPEG)
   - mostrar contagem de “arquivos suspeitos” no Bunny.
   Isso evita nova migração “aparentemente ok” com assets quebrados.

4. Criar rotina de reparo para arquivos corrompidos/inconsistentes:
   - localizar registros que apontam para assets inválidos;
   - reprocessar a partir da origem correta quando existir;
   - se a origem era IA e só existe o asset inválido, regenerar ou reenviar corretamente.
   Prioridade inicial:
   - `events.image_url`
   - `blog_posts.image_url`

5. Melhorar o fallback visual temporariamente:
   - em vez de trocar silenciosamente tudo para `dj-performance`, registrar erro com URL original para facilitar auditoria;
   - opcionalmente usar placeholder neutro, para diferenciar “imagem ausente” de “imagem quebrada por MIME/extensão”.
   Isso ajuda a não mascarar o problema no futuro.

Arquivos a alterar:
- `supabase/functions/generate-blog-post-v2/index.ts`
- `supabase/functions/generate-multi-event-article/index.ts`
- `supabase/functions/regenerate-blog-image/index.ts`
- `supabase/functions/upload-to-bunny/index.ts`
- `supabase/functions/batch-convert-webp/index.ts`
- `src/pages/Eventos.tsx`
- `src/pages/Blog.tsx`
- possivelmente `src/components/OptimizedImage.tsx` para logging/telemetria de erro

Resultado esperado:
- o preview e o site publicado passam a carregar as imagens reais do Bunny;
- o fallback genérico deixa de aparecer em massa;
- uploads novos não entram mais quebrados;
- fica possível identificar e reparar os assets já salvos incorretamente.

Sugestões de implementação em ordem:
1. Primeiro corrigir os 3 fluxos de geração IA, porque eles são a fonte mais clara de arquivos `.webp` inválidos.
2. Depois adicionar o diagnóstico de assinatura/MIME.
3. Por fim, rodar um reparo dos arquivos suspeitos e validar manualmente `/eventos` e `/blog`.
