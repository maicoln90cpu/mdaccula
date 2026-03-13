

## Problema: Imagens genéricas no gerador de artigos

### Causa raiz

No `generate-blog-post-v2/index.ts`, linhas 540-542, as variáveis do prompt de imagem vêm dos **campos do formulário**:

```
const imageKeywords = formFields.keywords || '';    // ← VAZIO
const imageMood = formFields.mood || '';             // ← VAZIO  
const imageVisualElements = formFields.visualElements || ''; // ← VAZIO
```

O formulário (`GenerateForm.tsx`) não tem campos para `keywords`, `mood` ou `visualElements`. Resultado: o prompt de imagem vai para a IA com essas variáveis **vazias**, gerando imagens genéricas de "música eletrônica" sem contexto.

Enquanto isso, o `regenerate-blog-image` funciona melhor porque ele **extrai keywords do conteúdo** e **infere o mood** a partir do texto — mas mesmo esse usa o mesmo modelo que também pode produzir genéricos.

### Solução

Reutilizar a lógica do `regenerate-blog-image` dentro do `generate-blog-post-v2`: após gerar o texto do artigo (quando já temos `eventData.content`, `eventData.title`, `eventData.excerpt`), **extrair keywords e inferir mood do conteúdo gerado** antes de montar o prompt de imagem.

### Alterações

**Arquivo: `supabase/functions/generate-blog-post-v2/index.ts`**

1. Adicionar as funções `extractKeywords` e `inferMood` (copiar do `regenerate-blog-image`) antes do `Deno.serve`
2. Nas linhas 540-542, substituir:
   - `imageKeywords = formFields.keywords || ''` → `extractKeywords(eventData.content || '')`
   - `imageMood = formFields.mood || ''` → `inferMood(eventData.content || '', imageTitle)`
   - `imageVisualElements` → construir a partir do título + categoria + excerpt

**Arquivo: `supabase/functions/regenerate-blog-image/index.ts`**

3. Atualizar o modelo de `google/gemini-2.5-flash-image-preview` para `google/gemini-2.5-flash-image` (nome correto do modelo disponível)

**Ambas as edge functions** precisam ser re-deployed após as alterações.

### Resultado esperado

O prompt de imagem passa de algo como:
```
Palavras-chave: (vazio)
Atmosfera desejada: (vazio)
Elementos visuais: (vazio)
```
Para:
```
Palavras-chave: promotoras, queer, coletivos, eletrônica, curadorias
Atmosfera desejada: celebratório
Elementos visuais: cultura, movimento, expressão artística
```

Isso dá contexto suficiente para a IA gerar imagens específicas ao tema do artigo.

