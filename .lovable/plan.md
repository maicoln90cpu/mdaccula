

## Diagnóstico dos Logs

Os logs da Edge Function mostram:

```
API key length after trim: 41
storage.bunnycdn.com → 401 {"HttpCode":401,"Message":"Unauthorized"}
br.storage.bunnycdn.com → 401 {"HttpCode":401,"Message":"Unauthorized"}
... (todas as 9 regiões retornaram 401)
```

**Todas as regiões retornam 401** — isso confirma que o problema não é de região/hostname. Se fosse, pelo menos uma região responderia 200.

O `.trim()` já está aplicado e o comprimento da chave é 41 caracteres. A questão agora é: **o valor do secret BUNNY_STORAGE_API_KEY salvo no Supabase está realmente correto?**

Possíveis causas restantes:
1. O secret foi salvo com **aspas** envolvendo o valor (ex: `"abc123..."` em vez de `abc123...`)
2. O secret contém **caracteres invisíveis** que `.trim()` não remove (ex: zero-width space)
3. Foi colada a **Account API Key** (do painel geral do Bunny) em vez da **Storage Zone Password** (da aba "FTP & API Access" da zone)

## Plano

### 1. Adicionar diagnóstico de formato da chave (sem expor o valor)
No `migrate-to-bunny/index.ts`, na ação `diagnose`, adicionar logs que verificam:
- Se a chave começa ou termina com `"` ou `'`
- Se contém caracteres non-ASCII
- Primeiro e último char code (número, não o caractere)
- Retornar essas flags no response como `key_diagnostics` para o frontend exibir

### 2. Aplicar sanitização agressiva na chave
Além de `.trim()`, remover aspas e caracteres non-printable:
```typescript
const bunnyApiKey = Deno.env.get("BUNNY_STORAGE_API_KEY")
  ?.trim()
  ?.replace(/^["']|["']$/g, '')  // remove wrapping quotes
  ?.replace(/[^\x20-\x7E]/g, ''); // remove non-printable
```

Aplicar em todas as 6 edge functions.

### 3. Mostrar diagnóstico de chave no frontend
No `MediaSettings.tsx`, exibir as flags de diagnóstico (sem revelar o secret):
- "Chave contém aspas: sim/não"
- "Chave contém caracteres especiais: sim/não"
- "Comprimento após sanitização: X"

### 4. Adicionar teste direto via curl no diagnóstico
Incluir na resposta do diagnóstico o comando curl exato para o usuário testar manualmente, confirmando se a chave no Supabase é a mesma que funciona no terminal.

### Arquivos alterados
- `supabase/functions/migrate-to-bunny/index.ts`
- `supabase/functions/upload-to-bunny/index.ts`
- `supabase/functions/batch-convert-webp/index.ts`
- `supabase/functions/generate-blog-post-v2/index.ts`
- `supabase/functions/regenerate-blog-image/index.ts`
- `supabase/functions/generate-multi-event-article/index.ts`
- `src/components/admin/settings/MediaSettings.tsx`

### Passo externo recomendado
Após implementar, se o diagnóstico mostrar que a chave está limpa e ainda der 401:
- Recomendarei re-salvar o secret `BUNNY_STORAGE_API_KEY` no Supabase
- A password correta está na aba **FTP & API Access** da storage zone `mdacula` no painel Bunny

