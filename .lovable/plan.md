

## Configuracao de Secrets e Limpeza de Edge Functions

### 1. RESEND_API_KEY (Obrigatorio para emails)

Usado por 3 edge functions:
- `send-contact-email` - formulario de contato
- `send-mass-newsletter` - envio de newsletter em massa
- `send-podcast-notification` - notificacao de novos podcasts

**O que voce precisa fazer:**
1. Acesse [resend.com](https://resend.com) e crie uma conta (ou faca login)
2. Va em **API Keys** e copie sua chave
3. Quando eu pedir, cole a chave no campo que vai aparecer

### 2. OPENAI_API_KEY (Opcional)

Usado por 3 edge functions quando o modelo selecionado no admin eh OpenAI (GPT):
- `generate-blog-post-v2`
- `generate-blog-suggestions`
- `generate-multi-event-article`

Todas essas funcoes ja funcionam com o `LOVABLE_API_KEY` (Gemini via gateway Lovable AI) que ja esta configurado. O OPENAI_API_KEY so eh necessario se voce quiser usar modelos GPT especificamente.

**Se quiser configurar:**
1. Acesse [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Crie uma nova API key
3. Os custos sao cobrados diretamente pela OpenAI

### 3. FIRECRAWL_API_KEY (Opcional)

Usado por 2 edge functions para scraping de fontes de noticias:
- `generate-blog-post-v2` - busca contexto de fontes antes de gerar artigo
- `generate-blog-suggestions` - scrape de fontes para sugestoes

Sem essa chave, as funcoes continuam funcionando mas nao fazem scraping de fontes externas.

**Se quiser configurar:**
1. Acesse [firecrawl.dev](https://firecrawl.dev) e crie uma conta
2. Copie sua API key

### 4. EXTERNAL_SUPABASE_URL e EXTERNAL_SUPABASE_SERVICE_KEY

Usados **apenas** pela edge function `sync-to-external` que sincroniza dados para um projeto Supabase externo. A pagina `BackupSync.tsx` em `/admin/backup-sync` chama essa funcao.

**Decisao necessaria:** Voce usa ou pretende usar sincronizacao com um Supabase externo?
- Se **nao**: vou remover a edge function `sync-to-external` e a pagina `BackupSync.tsx`, eliminando a necessidade desses secrets
- Se **sim**: precisarei das credenciais do projeto externo

### Plano de Implementacao

1. Solicitar o secret `RESEND_API_KEY` ao usuario
2. Perguntar se deseja configurar `OPENAI_API_KEY` e `FIRECRAWL_API_KEY`
3. Baseado na resposta sobre sync externo:
   - Remover `sync-to-external` e `BackupSync.tsx` se nao necessario
   - Ou solicitar os secrets se necessario
4. Atualizar o `README.md` para refletir o estado correto dos secrets

