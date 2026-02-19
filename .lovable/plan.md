

## Plano de Importacao Completa dos Dados e Correcao de URLs

### Resumo

Existem 5 CSVs para importar e um problema de URLs apontando para o Supabase antigo (`nzbyyuqvhrwatmydxiag`) que precisa ser corrigido para o novo (`xfvpuzlspvvsmmunznxw`).

### Estado Atual do Banco

| Tabela | No banco | No CSV | Acao |
|---|---|---|---|
| blog_posts | 34 | 113 | Inserir ~79 faltantes via UPSERT |
| events | 0 | 141 | Inserir todos |
| custom_links | 0 | 180 | Inserir todos |
| link_groups | 21 | Ja existem (importados anteriormente) | Nenhuma |
| ai_prompt_templates | 0 | 6 | Inserir todos |
| ai_generated_posts | 0 | 117 | Inserir todos |

### Etapas de Importacao

**Etapa 1 - ai_prompt_templates (6 registros)**
Inserir os 6 templates de IA. Sem dependencias.

**Etapa 2 - blog_posts (79 registros faltantes)**
UPSERT dos 113 registros do CSV. Os 34 existentes serao atualizados, os 79 novos serao inseridos. A coluna `search_vector` sera ignorada pois o trigger `update_blog_posts_search_trigger` regenera automaticamente.

**Etapa 3 - events (141 registros)**
Inserir todos os eventos. Referencias a `blog_post_id` dependem dos blog_posts ja estarem no banco (Etapa 2). Arrays como `lineup` e `genres` precisam de conversao de formato JSON (`["a","b"]`) para PostgreSQL (`{a,b}`).

**Etapa 4 - custom_links (180 registros)**
Inserir todos os links. Referencias a `group_id` (link_groups ja existem) e `event_id` (events da Etapa 3). Os IDs dos link_groups no CSV batem com os IDs ja no banco.

**Etapa 5 - ai_generated_posts (117 registros)**
Inserir todos. Referencias a `blog_post_id` e `template_id` dependem das Etapas 1 e 2.

**Etapa 6 - Correcao de URLs de imagens**
Executar UPDATE em massa em todas as tabelas para substituir:
`nzbyyuqvhrwatmydxiag.supabase.co` por `xfvpuzlspvvsmmunznxw.supabase.co`

Tabelas afetadas: `blog_posts.image_url`, `blog_posts.content` (URLs dentro do HTML), `events.image_url`, `custom_links.thumbnail_url`, `event_templates.image_url`, `recurring_event_configs.image_url`

### Desafios Tecnicos

1. **blog_posts.content** contem HTML extenso com aspas, quebras de linha e caracteres especiais -- requer escape cuidadoso
2. **blog_posts.search_vector** sera ignorado na importacao (regenerado pelo trigger)
3. **Arrays** no CSV usam formato JSON que precisa ser convertido para formato PostgreSQL
4. **Campos vazios** no CSV precisam ser tratados como NULL
5. **Volume**: ~630 registros no total, sera dividido em multiplas migrations para evitar timeout

### Sobre as Imagens

IMPORTANTE: A Etapa 6 so funciona se as imagens fisicas ja existirem nos buckets do novo projeto Supabase (`xfvpuzlspvvsmmunznxw`). Se as imagens nao foram copiadas do projeto antigo para o novo, as URLs corrigidas vao apontar para arquivos inexistentes. 

Voce precisara confirmar se as imagens ja foram migradas entre os buckets, ou se precisaremos de outro plano para isso.

### Sobre UI/Animacoes/Cores do Site Antigo

Para capturar todos os detalhes visuais do projeto antigo, envie este prompt ao projeto anterior:

---

**Prompt para o projeto antigo:**

> Liste TODOS os detalhes visuais e de UI do sistema atual, incluindo:
>
> 1. **Cores e Gradientes**: Todas as cores primarias, secundarias, de destaque, gradientes usados em backgrounds, cards, botoes e headers
> 2. **Tipografia**: Fontes utilizadas (font-family), tamanhos (font-size) para h1-h6, paragrafos e labels, font-weight e line-height
> 3. **Espacamento**: Paddings e margins padrao em containers, sections, cards e entre elementos
> 4. **Border-radius**: Arredondamentos usados em cards, botoes, inputs, modais e imagens
> 5. **Sombras (box-shadow)**: Todas as sombras usadas em cards, botoes elevados, modais e dropdowns
> 6. **Animacoes e Transicoes**: Todas as animacoes CSS (keyframes), transicoes hover, efeitos de entrada/saida, duracoes e easing functions
> 7. **Layout**: Larguras maximas de containers, breakpoints responsivos, grid/flex gaps
> 8. **Componentes especificos**: Estilo do Navbar (fixo/sticky, transparente, blur), Footer, Cards de eventos, Cards de links, Modais, Botoes (primario, secundario, outline, ghost), Inputs e forms
> 9. **Temas**: Configuracao de dark/light mode, variaveis CSS customizadas (--variavel)
> 10. **Efeitos visuais**: Backdrop-blur, glassmorphism, neon effects, hover scales, gradientes animados
> 11. **Icones**: Biblioteca de icones usada, tamanhos padrao
> 12. **Imagens**: Aspect ratios, object-fit, filtros aplicados, placeholders
>
> Extraia do index.css, tailwind.config.ts, componentes de UI e de cada pagina. Formate como um JSON ou tabela organizada por categoria.

---

### Ordem de Execucao

1. ai_prompt_templates
2. blog_posts (UPSERT)
3. events
4. custom_links
5. ai_generated_posts
6. UPDATE URLs de imagens (todas as tabelas)

Cada etapa sera uma migration SQL separada, executada em sequencia.
