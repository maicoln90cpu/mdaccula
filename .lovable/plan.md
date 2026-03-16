

## Respostas e Plano de Melhorias

### 1) Status da integração Supabase Storage

**Não foi apagada.** Os 3 buckets (`event-images`, `link-thumbnails`, `team-images`) continuam existindo no Supabase. O que mudou é que **quase todos os formulários** agora fazem upload para o Bunny via `uploadImageToBunny()`:

- EventForm, BlogForm, CustomLinkForm, TeamManager, EventTemplates, LinksPageSettings, MultiEventArticleModal — todos usam `convertToWebP()` + `uploadImageToBunny()`
- Edge Functions de IA (`generate-blog-post-v2`, `regenerate-blog-image`, `generate-multi-event-article`) — upload direto para Bunny

**Exceção encontrada**: `RecurringEventsManager.tsx` (linha 493) **ainda faz upload direto para o Supabase Storage** via `supabase.storage.from('event-images').upload()`. Este é um ponto que precisa ser corrigido.

### 2) Como funciona o sistema de imagens hoje

```text
┌─────────────────────────────────────────────────────────┐
│ UPLOAD MANUAL (formulários admin)                       │
│ File → convertToWebP (maxSizeMB=1, max=1920px)         │
│      → uploadImageToBunny() → Edge Function             │
│      → PUT binário no Bunny Storage → URL CDN salva no DB│
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ UPLOAD IA (generate-blog-post-v2, regenerate-blog-image)│
│ Gemini gera PNG → decode base64 → ImageScript resize    │
│ max 1024px + encodeWEBP(85) → PUT direto no Bunny      │
│ → URL CDN salva no DB                                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ LEITURA (frontend)                                      │
│ getOptimizedImageUrl() reescreve URLs Supabase → CDN    │
│ URLs já no Bunny passam direto                          │
│ OptimizedImage / LinkCardImage renderizam com lazy load  │
└─────────────────────────────────────────────────────────┘
```

**Respondendo suas perguntas específicas:**
- **IA gera imagem pesada?** Não, a `generate-blog-post-v2` já converte para WebP a 85% qualidade e redimensiona para max 1024px antes de subir para o Bunny
- **Upload manual é tratado automaticamente?** Sim, todos os formulários (exceto RecurringEventsManager) convertem para WebP no cliente antes de subir

### 3) Sobre a migração

**Comportamento atual**: A ação `migrate_files` **copia** os arquivos do Supabase para o Bunny, mas **NÃO deleta do Supabase**. A ação `update_urls` apenas reescreve as URLs no banco de dados.

**Não há verificação de que a imagem funciona no CDN antes de deletar do Supabase.** Concordo — precisamos de uma ação `cleanup_supabase` que só delete após verificar HTTP 200 no Bunny CDN.

### 4) Custos com a arquitetura atual

| Serviço | Custo |
|---------|-------|
| **Bunny Storage** | $0.01/GB/mês armazenado + $0.01/GB tráfego (Tier 1) |
| **Bunny CDN** | Incluído no tráfego acima |
| **Supabase Storage** | Grátis até 1GB (plano free) / Incluído no Pro. **Egress: $0.09/GB** após cota |
| **Supabase DB/Auth/Functions** | Continua igual, independente de onde as imagens estão |

**Economia principal**: Eliminar egress do Supabase. Se você tem 500MB de imagens servidas 1000x/mês, o Bunny custa ~$0.05/mês vs ~$45/mês no Supabase egress.

### 5) Cache: Bunny vs Cloudflare

**Bunny CDN** controla o cache das imagens (mdaccula.b-cdn.net). Configuração atual: `Cache-Control: public, max-age=31536000, immutable` (1 ano). O Bunny tem PoPs globais e cacheia na borda.

**Cloudflare** controla o cache do **site/HTML/JS/CSS** (mdaccula.com). Serve para:
- SSL/TLS (Full Strict)
- DDoS protection
- Brotli, HTTP/3, Early Hints
- Cache Rules para `/assets/*` (JS/CSS compilados pelo Vite)
- DNS

**As imagens NÃO passam pelo Cloudflare** — elas são servidas diretamente pelo `mdaccula.b-cdn.net`, que é um domínio do Bunny e não está proxied pelo Cloudflare. Isso é intencional para evitar conflitos de SSL.

---

## Plano de Implementação

### A. Corrigir RecurringEventsManager (upload ainda vai para Supabase)
- Trocar `supabase.storage.from().upload()` por `convertToWebP()` + `uploadImageToBunny()`

### B. Melhorar detalhes dos presets de compressão na UI
Atualizar `PRESET_LABELS` com informações detalhadas:
```
Sutil: WebP 85%, max 1920px → ~60-70% menor que PNG original
Média: WebP 70%, max 1280px → ~75-85% menor
Severa: WebP 50%, max 1024px → ~85-92% menor
```
Mostrar estimativa de economia em bytes antes de converter.

### C. Adicionar ação `cleanup_supabase` na migração
Nova ação na edge function `migrate-to-bunny` que:
1. Para cada arquivo no Supabase Storage, verifica se existe no Bunny CDN (HEAD request → 200)
2. Verifica se a URL no banco já aponta para o Bunny
3. Só então deleta do Supabase Storage
4. Retorna relatório detalhado

### D. Mostrar tamanho total no diagnóstico de migração
Calcular e exibir o total em MB de cada bucket no Supabase (já temos `metadata.size`), e comparar com o Bunny.

### E. 5 melhorias adicionais para o sistema de imagens
1. **Validação de tamanho pré-upload**: Alertar o admin se a imagem original > 5MB antes de comprimir
2. **Preview de economia**: Mostrar "antes/depois" em KB ao selecionar imagem no formulário
3. **Detecção de duplicatas**: Hash SHA256 no upload para evitar mesma imagem duplicada no storage
4. **Conversão AVIF fallback**: Para navegadores que suportam, servir AVIF (ainda menor que WebP) — futuro, depende do Bunny Optimizer
5. **Dashboard de economia**: Card no painel admin mostrando total de bytes economizados historicamente (soma dos logs de conversão)

### Arquivos alterados
- `src/pages/admin/RecurringEventsManager.tsx` — migrar upload para Bunny
- `src/components/admin/settings/MediaSettings.tsx` — presets detalhados, tamanho total, botão cleanup
- `supabase/functions/migrate-to-bunny/index.ts` — ação `cleanup_supabase`, tamanho em bytes no diagnóstico

