

## Plano: Corrigir sistema de imagens e garantir tudo no Bunny

### Diagnóstico

1. **Imagens de IA**: Já vão para o Bunny (`event-images/ai-generated-*.webp`). O código em `generate-blog-post-v2` faz PUT direto no Bunny. Se aparecem vazias no Bunny, pode ser que imagens **antigas** (antes da migração) ainda estejam só no Supabase.

2. **`batch-convert-webp` quebrado**: Usa `createImageBitmap` + `OffscreenCanvas` que **não funcionam no Deno**. Resultado: 100% de erros. Além disso, após converter, faz upload **de volta para o Supabase** em vez do Bunny.

3. **Análise single-bucket**: O botão "Analisar Acervo" envia `bucket: "event-images"` fixo, ignorando `link-thumbnails` e `team-images`.

---

### Correções

#### A. Reescrever `batch-convert-webp` com ImageScript + upload para Bunny
- Substituir `createImageBitmap`/`OffscreenCanvas` por `Image` do ImageScript (já funciona em outras functions)
- Após converter, fazer PUT no Bunny Storage (não mais no Supabase)
- Atualizar a URL no banco de dados para apontar para o CDN do Bunny
- Arquivos: `supabase/functions/batch-convert-webp/index.ts`

#### B. Análise multi-bucket
- Quando `bucket === "all"`, iterar sobre os 3 buckets e agregar resultados
- Atualizar o frontend para enviar `bucket: "all"` por padrão
- Arquivos: `supabase/functions/batch-convert-webp/index.ts`, `src/components/admin/settings/MediaSettings.tsx`

#### C. Diagnóstico com tamanhos Bunny
- Na ação `diagnose` do `migrate-to-bunny`, somar `Length` dos arquivos no Bunny para cada bucket
- Exibir `bunny_bucket_sizes` no painel com contagem + MB
- Arquivos: `supabase/functions/migrate-to-bunny/index.ts`, `src/components/admin/settings/MediaSettings.tsx`

#### D. Validação pré-upload (>5MB)
- Em `webpConverter.ts`, verificar `file.size > 5MB` antes de comprimir e lançar erro descritivo
- Arquivo: `src/lib/webpConverter.ts`

#### E. Preview de economia antes/depois
- Criar hook `useImagePreview` que mostra tamanho original vs comprimido em KB + %
- Integrar nos formulários principais
- Arquivos: `src/hooks/useImagePreview.ts` (novo), formulários existentes

#### F. Detecção de duplicatas SHA256
- Na edge function `upload-to-bunny`, calcular SHA256 do arquivo
- Criar tabela `image_hashes(hash text PK, url text, bucket text, created_at timestamptz)`
- Se hash já existe, retornar URL existente sem re-upload
- Arquivos: `supabase/functions/upload-to-bunny/index.ts`, migration SQL

#### G. Dashboard de economia
- Card no topo de MediaSettings mostrando total armazenado no Bunny e estimativa de economia vs Supabase egress
- Dados do `diagnose` já existente

### Arquivos alterados
- `supabase/functions/batch-convert-webp/index.ts` — reescrita completa com ImageScript + Bunny
- `supabase/functions/migrate-to-bunny/index.ts` — bunny_bucket_sizes no diagnóstico
- `supabase/functions/upload-to-bunny/index.ts` — SHA256 deduplicação
- `src/lib/webpConverter.ts` — validação 5MB
- `src/hooks/useImagePreview.ts` — novo hook
- `src/components/admin/settings/MediaSettings.tsx` — multi-bucket, dashboard, preview
- Migration SQL — tabela `image_hashes`

