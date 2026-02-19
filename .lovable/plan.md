
## Nova Abordagem: Parse CSV no Frontend + Envio JSON

### Problema Atual
O parser CSV na edge function nao consegue lidar com campos que contem arrays JSON como `["House","Deep House","Progressive"]`. As virgulas dentro desses arrays quebram o parse, desalinhando todas as colunas subsequentes. Por isso:
- blog_posts: titulo vai para campo UUID
- events: slug vai para campo UUID  
- custom_links: boolean vai para campo timestamp
- ai_generated_posts: texto vai para campo timestamp

### Nova Estrategia
Abandonar o parse de CSV na edge function. Em vez disso:

1. **Frontend (DataImport.tsx)** faz o parse do CSV usando a biblioteca **Papa Parse** (robusta, lida com campos quoted, arrays, HTML, etc.)
2. Frontend converte os registros CSV em **objetos JSON** com os nomes corretos dos campos
3. Frontend envia os objetos JSON para a edge function via `{ table: "...", records: [...] }`
4. Edge function recebe JSON puro e faz o upsert direto (sem parse de CSV)

### Mudancas Necessarias

**1. Adicionar dependencia `papaparse`**
Biblioteca robusta de parse CSV que lida corretamente com campos quoted, newlines dentro de campos, e caracteres especiais.

**2. Atualizar `src/pages/admin/DataImport.tsx`**
- Importar PapaParse
- Para cada tabela, fetch o CSV de `/import/`, parse com PapaParse, enviar como JSON records
- Enviar em batches de 10-20 registros para evitar timeout
- Mostrar progresso por batch

**3. Atualizar `supabase/functions/import-csv-data/index.ts`**
- Limpar/simplificar: quando receber `records` como JSON, nao precisa converter tipos -- os valores ja vem corretos do frontend
- Adicionar limpeza de campos: remover `search_vector` dos blog_posts, converter strings "true"/"false" para boolean, tratar arrays JSON, tratar campos vazios como null

**4. Copiar os CSVs atualizados do usuario para `/public/import/`**
Os CSVs que o usuario enviou nesta conversa substituem os anteriores.

### Fluxo

```text
Usuario clica "Importar"
       |
DataImport.tsx busca /import/events.csv
       |
PapaParse converte CSV → JSON objects
       |
Frontend envia batches de JSON para edge function
  { table: "events", records: [{id: "...", title: "...", ...}, ...] }
       |
Edge function faz upsert direto no Supabase
       |
Resultado mostrado na tela
```

### Ordem de Importacao (mantida)
1. blog_posts (UPSERT, ~113 registros)
2. events (~141 registros)
3. custom_links (~180 registros)
4. ai_generated_posts (~117 registros)
5. Correcao de URLs de imagens (todas as tabelas)

### Detalhes Tecnicos

- **PapaParse config**: `{ header: true, skipEmptyLines: true, dynamicTyping: false }` -- mantemos tudo como string e convertemos no edge function
- **Batching**: 10 registros por batch para blog_posts (conteudo HTML grande), 20 para as demais
- **Campo `search_vector`**: Removido no frontend antes do envio (regenerado por trigger no banco)
- **Arrays (`lineup`, `genres`, `source_urls`)**: PapaParse vai retornar a string JSON como esta. O edge function ja tem `cleanArray()` que converte para PostgreSQL array
- **Campos booleanos**: `cleanBool()` ja existe no edge function
- **Campos de timestamp**: `cleanValue()` ja retorna a string ou null
