

## Plano: Conversao WebP em todos os uploads + Correcao de imagens cortadas na /links

---

### Parte 1: Correcao das imagens cortadas na pagina /links

**Problema**: O container tem `overflow-hidden` + `max-h-20` (80px). Imagens retrato (flyers) sao mais altas que 80px e ficam cortadas pelo overflow. Grid e Klandestine funcionam porque sao mais quadradas.

**Solucao**: Remover `max-h-20` e `overflow-hidden` do container. Usar apenas largura fixa (`w-14 sm:w-16`) e deixar a altura adaptar naturalmente. A imagem usa `w-full h-auto object-contain`, entao a largura fixa ja controla o tamanho total. O card tem `height: auto` e se adapta.

**Arquivos**:
- `SimpleLinkCard.tsx` — Standard: trocar `w-14 sm:w-16 max-h-20 flex-shrink-0 rounded-md overflow-hidden bg-muted/20 flex items-center justify-center` por `w-14 sm:w-16 flex-shrink-0 rounded-md bg-muted/20 flex items-center justify-center`. Featured: trocar `w-20 sm:w-24 max-h-28 flex-shrink-0 rounded-lg overflow-hidden bg-muted/20` por `w-20 sm:w-24 flex-shrink-0 rounded-lg bg-muted/20`
- `SortableLinkCard.tsx` — Mesmas mudancas nos mesmos containers

---

### Parte 2: Utilitario central de conversao WebP

Criar `src/lib/webpConverter.ts` com uma funcao reutilizavel:

```ts
export async function convertToWebP(file: File | Blob, maxSizeMB = 1, maxDimension = 1920): Promise<File>
```

Internamente usa `browser-image-compression` (ja instalado) com `fileType: 'image/webp'`. Retorna um `File` com nome `.webp`. Todos os uploads do frontend passarao por esta funcao antes de chamar `supabase.storage.upload()`.

---

### Parte 3: Migrar todos os uploads do frontend para WebP

**Uploads que JA convertem para WebP** (via ImageUploadWithCrop):
- LinksPageSettings (avatar)
- RecurringEventsManager (ja usa `imageCompression` + `.webp`)

**Uploads que NAO convertem** (precisam ser corrigidos):

1. **EventForm.tsx** (linha 230) — `handleImageChange` aceita qualquer formato e faz upload direto. Adicionar `convertToWebP()` antes do upload e mudar extensao para `.webp`.

2. **BlogForm.tsx** (linha 72) — Usa `ImageUploadWithCrop` que ja converte para WebP, MAS o `uploadImage` usa a extensao original do arquivo (`fileExt`). Trocar para `.webp` fixo e adicionar `contentType: 'image/webp'`.

3. **TeamManager.tsx** (linha 95) — Upload direto sem conversao. Adicionar `convertToWebP()` antes do upload.

4. **EventTemplates.tsx** (linha 93) — Usa `ImageUploadWithCrop` que ja converte, mas `uploadImage` usa extensao original. Trocar para `.webp`.

5. **MultiEventArticleModal.tsx** (linha 162) — Upload direto. Adicionar `convertToWebP()`.

6. **CustomLinkForm.tsx** (linha 190) — Upload com extensao original. Ja tem logica de conversao server-side, mas adicionar `convertToWebP()` no cliente para consistencia.

---

### Parte 4: Edge Functions — Converter imagens AI para WebP

**Functions que geram imagens e NAO salvam como WebP**:

1. **regenerate-blog-image/index.ts** (linha 207) — Salva como `.jpg` com `contentType: 'image/jpeg'`. A imagem vem como base64 PNG do Gemini. Converter para WebP usando canvas no Deno ou salvar como `.webp` com o buffer direto (o Supabase aceita qualquer contentType).

2. **generate-multi-event-article/index.ts** (linha 398) — Salva como `.png`. Mesma correcao: mudar para `.webp` e `contentType: 'image/webp'`.

**Function que JA salva como WebP**:
- `generate-blog-post-v2/index.ts` (linha 607) — Ja usa `contentType: 'image/webp'`. OK.

**Nota sobre Edge Functions**: No Deno nao temos `canvas` nativo. A solucao mais simples e salvar o buffer PNG/JPEG do Gemini diretamente com `contentType: 'image/webp'` e extensao `.webp`. Isso funciona porque o Supabase Storage aceita qualquer contentType declarado — MAS o browser pode nao renderizar corretamente se o binario nao for realmente WebP.

**Alternativa robusta**: Usar uma lib Deno como `jsr:@nicolo-ribaudo/sharp` ou converter via canvas na Edge Function. Ou aceitar que imagens AI ficam em PNG/JPEG (ja otimizadas pelo Gemini) e focar a conversao WebP apenas nos uploads do frontend onde temos `canvas`.

---

### Resumo de arquivos alterados

```text
FRONTEND (conversao WebP no cliente)
├── src/lib/webpConverter.ts ..................... NOVO — utilitario central
├── src/components/events/EventForm.tsx .......... converter antes do upload
├── src/components/blog/BlogForm.tsx ............. usar extensao .webp
├── src/pages/admin/TeamManager.tsx .............. converter antes do upload
├── src/pages/admin/EventTemplates.tsx ........... usar extensao .webp
├── src/components/admin/MultiEventArticleModal.tsx  converter antes do upload
├── src/components/links/CustomLinkForm.tsx ....... converter antes do upload

IMAGENS /LINKS (correcao de corte)
├── src/components/links/SimpleLinkCard.tsx ....... remover overflow-hidden + max-h
├── src/components/links/SortableLinkCard.tsx ..... idem

EDGE FUNCTIONS (imagens AI)
├── supabase/functions/regenerate-blog-image/index.ts ... mudar .jpg → .webp
├── supabase/functions/generate-multi-event-article/index.ts ... mudar .png → .webp
```

