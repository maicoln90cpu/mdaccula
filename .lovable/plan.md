

## Plano: Sistema de prompts de imagem com estilos variados

### Problema
Todas as imagens geradas (criação e regeneração) usam o mesmo estilo de prompt, resultando em imagens visualmente repetitivas.

### Solução
Criar um array de 5 estilos visuais distintos, selecionar aleatoriamente evitando repetir o último usado (armazenando o último estilo no campo `site_settings` com chave `last_image_style_index`).

### Estilos propostos
1. **Fotorrealista cinematográfico** — profundidade de campo, iluminação dramática, contraste forte
2. **Arte digital neon/cyberpunk** — cores neon, gradientes vibrantes, estética futurista
3. **Ilustração artística/pintura** — estilo pintura a óleo ou aquarela digital, texturas pictóricas
4. **Minimalista abstrato** — formas geométricas, composição limpa, paleta reduzida
5. **Colagem editorial/mixed media** — sobreposição de texturas, camadas visuais, estética de revista

### Lógica de seleção
- Buscar `last_image_style_index` do `site_settings`
- Filtrar esse índice do array e sortear aleatoriamente entre os restantes
- Salvar o novo índice no `site_settings` após uso

### Arquivos a alterar

1. **`supabase/functions/generate-blog-post-v2/index.ts`**
   - Substituir o `DEFAULT_IMAGE_PROMPT` único por array `IMAGE_STYLE_PROMPTS` com 5 variantes
   - Adicionar função `pickRandomStyle(supabase)` que lê/grava `last_image_style_index`
   - Na hora de gerar imagem, chamar `pickRandomStyle` e usar o template selecionado

2. **`supabase/functions/regenerate-blog-image/index.ts`**
   - Mesma lógica: array de estilos + `pickRandomStyle`
   - Se `ai_image_prompt_template` customizado existir no banco, usar ele (manter compatibilidade)
   - Se não, usar o sistema de estilos aleatórios

3. **`supabase/functions/generate-multi-event-article/index.ts`**
   - O prompt de imagem é hardcoded inline — substituir pelo mesmo array de estilos + seleção aleatória

4. **Migração SQL** (opcional mas recomendado)
   - Inserir registro `last_image_style_index` com valor `0` em `site_settings` para inicializar

### Detalhe técnico
Cada estilo terá as mesmas variáveis `{{title}}`, `{{summary}}`, `{{category}}`, `{{keywords}}`, `{{mood}}`, `{{visualElements}}` — só muda a instrução de estilo visual e as diretrizes artísticas.

