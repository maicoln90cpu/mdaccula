

## Problema encontrado: `?quality=75` quebra TODAS as imagens

### Diagnóstico

Testei as URLs do Bunny CDN diretamente:

- `cdn.mdaccula.com/event-images/image.webp` -- **funciona** (retorna imagem WEBP)
- `cdn.mdaccula.com/event-images/image.webp?quality=75` -- **403 FeatureNotEnabled**

O parâmetro `?quality=75` depende do **Bunny Optimizer**, que e um recurso pago/opcional da Bunny que **nao esta ativado** na sua Pull Zone. Quando o CDN recebe um query param de otimizacao (`quality`, `width`, `height`), ele tenta processar via Optimizer e retorna 403 se o recurso nao esta habilitado.

Como `getOptimizedImageUrl()` adiciona `?quality=75` em **todas** as URLs reescritas, **todas as imagens do site ficam quebradas** e caem no fallback generico (`djImage` / placeholder).

### Solucao

Remover o append de `?quality=75` do `getOptimizedImageUrl`. A funcao passa a fazer **apenas** o domain rewrite (Supabase -> Bunny CDN), sem nenhum query param de otimizacao.

### Alteracao

**Arquivo: `src/lib/imageUtils.ts`**

Simplificar a funcao: apos extrair o path e limpar params legados, retornar `${BUNNY_CDN_HOST}/${imagePath}` diretamente, sem adicionar `quality=75`.

Remover as linhas 74-82 (bloco que adiciona quality param) e retornar apenas `cdnUrl`.

### Resultado

- Todas as imagens voltam a carregar via CDN imediatamente
- Zero risco de distorcao (nenhum param de dimensao)
- Se voce quiser ativar otimizacao de qualidade no futuro, basta habilitar o Bunny Optimizer no painel da Bunny e reativar o param

