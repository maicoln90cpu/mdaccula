

## Corrigir Importacao de Dados - Abordagem Robusta

### Problemas Identificados

1. **Efeito cascata de foreign keys**: events depende de blog_posts, custom_links depende de events e link_groups, ai_generated_posts depende de blog_posts. Como blog_posts e events falharam parcialmente, tudo que depende deles falha.

2. **CSV parsing com HTML**: Alguns blog_posts tem conteudo HTML complexo com aspas e newlines que quebram o parser CSV, causando desalinhamento de colunas (titulo vai para campo UUID).

3. **Upsert em batch**: Quando 1 registro de um batch de 10-20 falha, o batch inteiro eh rejeitado pelo PostgreSQL, perdendo os outros registros validos.

### Solucao

**Duas mudancas principais na edge function:**

**A. Upsert registro-por-registro** (em vez de batch)
- Em vez de enviar 20 registros de uma vez para o PostgreSQL, inserir um por um
- Se um registro falha, os outros continuam
- Retorna contagem exata de sucesso/falha

**B. Limpar foreign keys orfas antes do upsert**
- Para events: se `blog_post_id` nao existe em blog_posts, setar como null
- Para custom_links: se `event_id` nao existe em events, setar como null. Se `group_id` nao existe em link_groups, setar como null
- Para ai_generated_posts: se `blog_post_id` nao existe em blog_posts, setar como null

Isso garante que todos os registros sao importados, mesmo que percam a referencia FK (que pode ser corrigida manualmente depois).

### Mudancas nos Arquivos

**1. `supabase/functions/import-csv-data/index.ts`**
- Adicionar funcao `getExistingIds(supabase, table)` que busca todos os IDs de uma tabela
- Antes do upsert, verificar se FKs existem; se nao, setar como null
- Trocar upsert em batch por loop de upsert individual
- Retornar contagem detalhada: `{ inserted, skipped, errors, orphanedFKs }`

**2. `src/pages/admin/DataImport.tsx`**
- Reduzir batch size para 5 registros (menor payload por request)
- Melhorar exibicao de resultados com contagem de FKs orfas
- Contar resultados parciais (se 3 de 5 deram certo, somar 3)

### Fluxo Atualizado

```text
Frontend envia batch de 5 registros
        |
Edge function recebe records
        |
Busca IDs existentes das tabelas FK (blog_posts, events, link_groups)
        |
Para cada registro:
  - Limpa FK fields que referenciam IDs inexistentes (seta null)
  - Tenta upsert individual
  - Se falha, registra erro e continua
        |
Retorna { inserted: 4, errors: 1, orphanedFKs: 2, errorDetails: [...] }
```

### Resultado Esperado

- blog_posts: ~106 (os que falharem serao por HTML mal-formado no CSV, inevitavel)
- events: ~141 (todos, com blog_post_id null onde necessario)
- custom_links: ~180 (todos, com event_id null onde necessario)  
- ai_generated_posts: ~117 (todos, com blog_post_id null onde necessario)
