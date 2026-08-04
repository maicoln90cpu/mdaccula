# Guia de Configuração do Banco Externo para Sync

Este documento contém os comandos SQL necessários para preparar o banco de dados Supabase externo para receber os backups/sync do sistema.

## 1. Adicionar Colunas Faltantes

Execute estes comandos no SQL Editor do Supabase externo:

```sql
-- Adicionar coluna card_width na tabela custom_links
ALTER TABLE public.custom_links 
ADD COLUMN IF NOT EXISTS card_width integer DEFAULT 650;

-- Adicionar coluna address na tabela events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS address text;

-- Atualizar valores existentes se necessário
UPDATE public.custom_links 
SET card_width = 650 
WHERE card_width IS NULL;
```

## 2. Configurar Row Level Security (RLS)

### 2.1 Verificar Service Role Key

O sync usa a **service role key** que tem permissões completas. Certifique-se de que a variável `EXTERNAL_SUPABASE_SERVICE_KEY` está configurada corretamente no Lovable.

### 2.2 Políticas RLS Recomendadas

Se você quiser manter RLS ativo no banco externo, crie estas políticas para permitir inserções via service role:

```sql
-- Política para profiles
CREATE POLICY "Service role can manage profiles"
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Política para user_roles
CREATE POLICY "Service role can manage user_roles"
ON public.user_roles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Política para team_members
CREATE POLICY "Service role can manage team_members"
ON public.team_members
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Política para link_groups
CREATE POLICY "Service role can manage link_groups"
ON public.link_groups
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Política para custom_links
CREATE POLICY "Service role can manage custom_links"
ON public.custom_links
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Política para events
CREATE POLICY "Service role can manage events"
ON public.events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Política para blog_posts
CREATE POLICY "Service role can manage blog_posts"
ON public.blog_posts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Política para ai_prompt_templates
CREATE POLICY "Service role can manage ai_prompt_templates"
ON public.ai_prompt_templates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Política para ai_generated_posts
CREATE POLICY "Service role can manage ai_generated_posts"
ON public.ai_generated_posts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Política para news_sources
CREATE POLICY "Service role can manage news_sources"
ON public.news_sources
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Política para newsletter_popup_variants
CREATE POLICY "Service role can manage newsletter_popup_variants"
ON public.newsletter_popup_variants
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Política para newsletter_subscribers
CREATE POLICY "Service role can manage newsletter_subscribers"
ON public.newsletter_subscribers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Política para site_settings
CREATE POLICY "Service role can manage site_settings"
ON public.site_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

## 3. Verificação

Após aplicar as mudanças, verifique:

1. Todas as colunas existem:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('custom_links', 'events');
```

2. As políticas RLS estão ativas:
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

## 4. Testar Sync

Após configurar tudo:

1. Vá para `/admin/backup-sync`
2. Clique em "Testar Conexão"
3. Se sucesso, clique em "Executar Sync Agora"
4. Verifique os logs para confirmar que não há mais erros

## Notas Importantes

- **Service Role Key**: Guarde esta chave com segurança. Ela tem acesso total ao banco.
- **RLS**: As políticas acima permitem que o service role faça qualquer operação. Isso é necessário para o sync funcionar.
- **Schema Sync**: Sempre que adicionar novas tabelas ou colunas no banco principal, lembre-se de replicá-las no banco externo.
- **Backup Regular**: Configure backups automáticos no Supabase externo para não perder dados.

## Suporte

Se encontrar problemas:

1. Verifique os logs em `/admin/backup-sync`
2. Confirme que a service role key está correta
3. Teste a conexão antes de fazer sync completo
4. Verifique se todas as tabelas têm as mesmas colunas nos dois bancos
