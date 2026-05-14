# Plano — Opção A: Imagem em background (eliminar 504)

## Objetivo
Acabar com o erro `504 timeout` na geração de artigos por IA, separando **texto** (síncrono, rápido) e **imagem** (assíncrono, em segundo plano). O artigo é salvo na hora; a capa aparece sozinha em ~20–40s depois.

---

## Antes vs Depois

**Antes (atual):**
```
[invoke] → texto IA (50–80s) → imagem IA (25–35s) → save → response
                                                          ↑
                                          frequentemente estoura → 504
```

**Depois (Opção A):**
```
[invoke] → texto IA → save (sem imagem) → response 200 ✅
                              ↓ (background, não bloqueia)
                     EdgeRuntime.waitUntil:
                       imagem IA → upload Bunny → UPDATE blog_posts.image_url
```

---

## Etapas (deploy em fases)

### Etapa 1 — Edge function `generate-blog-post-v2`
Arquivo: `supabase/functions/generate-blog-post-v2/index.ts`

1. Após gerar o texto e fazer `INSERT` em `blog_posts`, **retornar 200 imediatamente** (sem `image_url`).
2. Mover toda a lógica de imagem para uma função `generateImageInBackground(postId, prompt, ctx)`.
3. Disparar com `EdgeRuntime.waitUntil(generateImageInBackground(...))` antes do `return`.
4. Dentro do background:
   - Gerar imagem via AI Gateway (mesmo modelo atual).
   - Upload para Bunny Storage (helper já existe).
   - `UPDATE blog_posts SET image_url = ... WHERE id = postId`.
   - Em caso de erro: log em `application_logs`, sem derrubar nada.
5. Adicionar log estruturado: `{ postId, textMs, totalMs, imageQueued: true }`.

### Etapa 2 — UX no frontend
Arquivos: `src/pages/admin/AIContent2.tsx`, `src/components/admin/ai-content/PostsHistory.tsx`

1. Badge "Gerando imagem…" em posts com `image_url IS NULL` criados nos últimos 2 min.
2. Auto-refresh leve da lista a cada 15s enquanto houver posts pendentes de imagem.
3. Toast ajustado: "Artigo gerado! Imagem sendo processada em segundo plano."

### Etapa 3 — Validação e proteção permanente
1. Teste manual: 1 sugestão → resposta < 60s, imagem em ~30s.
2. Lote de 5 → 0 timeouts.
3. Teste Deno cobrindo: "se imagem falhar, post permanece criado".
4. Monitorar logs por 24h após deploy.

---

## Vantagens
- Elimina ~99% dos 504 (texto sozinho raramente passa de 60s).
- Usuário vê resultado **na hora**.
- Lote fica muito mais rápido (não espera imagem entre artigos).
- Falha de imagem **não derruba** o artigo.

## Desvantagens
- Card aparece **alguns segundos sem capa** (mitigado por badge + polling).
- 1 query extra (`UPDATE`) por artigo.
- Se o background morrer (raro), capa fica faltando — já existe `regenerate-blog-image` para recuperar.

---

## Checklist manual de validação
- [ ] Gerar 1 artigo via Sugestões → resposta em < 60s, toast aparece, artigo no histórico (sem capa).
- [ ] Aguardar ~40s e recarregar histórico → capa apareceu.
- [ ] Gerar 5 sugestões em lote → 0 erros 504.
- [ ] Verificar `application_logs` mostra timing estruturado.
- [ ] Forçar erro de imagem (chave inválida temporária) → artigo continua salvo.

---

## Pendências futuras (sobre o que vou implementar)
- Botão "Regerar imagem" no card do histórico (helper já existe, falta UI).
- Retry automático se a imagem falhar 1x.
- Indicador via realtime/websocket no lugar do polling.

---

## Prevenção de regressão
- **Teste Deno** novo: edge retorna 200 mesmo se `generateImage` lançar erro.
- **Log estruturado** `{ textMs, imageQueued, totalMs }` em toda execução, fácil de monitorar.
- **Memória do projeto** atualizada em `mem://features/ai-article-generation` registrando o padrão "imagem em background".

---

## Próximos passos (como fica)
- **Hoje:** geração trava no 504 quando passa de 140s.
- **Depois:** artigo salvo em <60s sempre; capa aparece sozinha em segundo plano. Ganho: zero perda de geração + UX muito mais rápido, principalmente em lote.

Posso aplicar?