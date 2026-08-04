# 🔄 Sistema de Backup Automático - Guia Completo

Este documento descreve o sistema de backup/sincronização automática configurado entre Lovable Cloud e seu Supabase externo.

---

## 📋 Visão Geral

O sistema sincroniza automaticamente todos os dados do banco Lovable Cloud para um projeto Supabase externo a cada **12 horas**, garantindo backup completo e recuperação de desastres.

### ✅ O que é sincronizado:
- ✓ Todas as tabelas do banco de dados
- ✓ Metadados dos arquivos no Storage
- ✓ Estrutura completa do schema

---

## 🚀 Configuração Inicial

### Passo 1: Replicar o Schema no Supabase Externo

1. Acesse o **SQL Editor** do seu projeto Supabase externo
2. Execute **todos** os arquivos de migração na ordem:
   - Localize: `supabase/migrations/*.sql`
   - Execute em ordem cronológica (pelo nome do arquivo)
   - Aguarde cada execução completar antes de prosseguir

### Passo 2: Configurar Cron Job no Supabase Externo

Execute este SQL no **SQL Editor** do Supabase externo:

```sql
-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar job de sincronização a cada 12 horas
SELECT cron.schedule(
  'sync-from-lovable-cloud',
  '0 */12 * * *',  -- A cada 12 horas (meia-noite e meio-dia)
  $$
  SELECT net.http_post(
    url := 'https://nzbyyuqvhrwatmydxiag.supabase.co/functions/v1/sync-to-external',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56Ynl5dXF2aHJ3YXRteWR4aWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNDg3MTAsImV4cCI6MjA3NzgyNDcxMH0.tBbQNUzdS5qBH0ER_AhxnMdpa805HqZEA3bmzPD3svc'
    ),
    body := jsonb_build_object('triggered_by', 'cron')
  ) as request_id;
  $$
);
```

### Passo 3: Verificar Configuração

1. Acesse `/admin/backup-sync` no seu site
2. Clique em **"Testar Conexão"**
3. Se tudo estiver OK, clique em **"Executar Sync Agora"** para testar

---

## 🎯 Usando o Sistema

### Interface Admin (`/admin/backup-sync`)

A interface fornece:

1. **Dashboard de Status**
   - Último sync executado
   - Total de registros sincronizados
   - Taxa de sucesso histórica

2. **Controles Manuais**
   - `Executar Sync Agora`: Força sincronização imediata
   - `Testar Conexão`: Verifica credenciais do Supabase externo

3. **Histórico Completo**
   - Últimas 50 sincronizações
   - Detalhes de cada execução
   - Logs de erros e avisos

---

## ⚙️ Configurações Avançadas

### Alterar Frequência do Sync

Modifique a linha do cron job:

```sql
-- A cada 6 horas
'0 */6 * * *'

-- A cada 1 hora
'0 * * * *'

-- Diariamente às 3h da manhã
'0 3 * * *'

-- A cada 30 minutos
'*/30 * * * *'
```

### Verificar Status do Cron Job

```sql
-- Listar jobs ativos
SELECT * FROM cron.job;

-- Verificar histórico de execuções
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;

-- Desabilitar job temporariamente
SELECT cron.unschedule('sync-from-lovable-cloud');

-- Reabilitar job
-- (execute novamente o SELECT cron.schedule)
```

---

## 🔍 Monitoramento e Logs

### Verificar Logs de Sincronização

No Lovable Cloud:
```sql
SELECT * FROM sync_logs 
ORDER BY started_at DESC 
LIMIT 10;
```

### Interpretando Status

- ✅ **success**: Tudo sincronizado com sucesso
- ⚠️ **warning**: Sincronizado com avisos (algumas tabelas falharam)
- ❌ **failed**: Sincronização falhou completamente
- 🔄 **running**: Sincronização em andamento

---

## 🆘 Recuperação de Desastres

### Cenário 1: Restauração Total

Se perder todos os dados do Lovable Cloud:

1. **Configure novo projeto Lovable Cloud**
2. **Execute todas as migrações** do Supabase externo
3. **Copie dados do backup**:
   ```sql
   -- Para cada tabela
   INSERT INTO lovable_cloud.table_name
   SELECT * FROM external_supabase.table_name;
   ```

### Cenário 2: Restauração Parcial (Tabela Específica)

Para restaurar apenas uma tabela:

```sql
-- 1. Limpar dados atuais (opcional)
TRUNCATE lovable_cloud.events CASCADE;

-- 2. Copiar do backup
INSERT INTO lovable_cloud.events
SELECT * FROM external_supabase.events;
```

### Cenário 3: Rollback Temporal

Para voltar para um estado anterior:

1. Identifique o sync desejado em `/admin/backup-sync`
2. Anote o timestamp: `started_at`
3. Execute queries com filtro temporal no Supabase externo

---

## 🧪 Testes Recomendados

### Teste 1: Sincronização Manual

1. Adicione um evento de teste
2. Vá em `/admin/backup-sync`
3. Clique em "Executar Sync Agora"
4. Verifique no Supabase externo se o evento apareceu

### Teste 2: Integridade dos Dados

```sql
-- No Lovable Cloud
SELECT COUNT(*) as lovable_count FROM events;

-- No Supabase Externo
SELECT COUNT(*) as external_count FROM events;

-- Devem ser iguais após sync
```

### Teste 3: Performance

Monitore os tempos de sincronização em `/admin/backup-sync`:
- Normal: 10-30 segundos
- Atenção: 30-60 segundos
- Problema: > 60 segundos (considere otimizar)

---

## ⚡ Otimizações

### Reduzir Tempo de Sincronização

1. **Sync Incremental**: Apenas dados modificados
   - Já implementado por padrão
   - Usa `updated_at` para detectar mudanças

2. **Excluir Tabelas Grandes** (se necessário):
   - Edite `supabase/functions/sync-to-external/index.ts`
   - Remova tabelas da array `tables`

3. **Aumentar Recursos do Edge Function**:
   - Configure timeout maior se necessário
   - Veja documentação Supabase

---

## 🔒 Segurança

### Proteja suas Credenciais

✅ **Correto**:
- Secrets configurados via interface Lovable
- Variáveis de ambiente no Supabase

❌ **Nunca**:
- Commit de credenciais no código
- Compartilhar SERVICE_ROLE_KEY publicamente

### Auditoria

Todos os syncs são logados:
- Quem executou (`triggered_by`)
- Quando (`started_at`, `completed_at`)
- O que foi sincronizado (`tables_synced`)
- Erros (`errors`)

---

## 📞 Suporte

### Problemas Comuns

**1. "Erro ao testar conexão"**
- ✓ Verifique se os secrets estão configurados
- ✓ Teste URL e KEY diretamente no Supabase
- ✓ Confirme que o Supabase externo está ativo

**2. "Sincronização falhou"**
- ✓ Verifique logs em `/admin/backup-sync`
- ✓ Confirme schema replicado corretamente
- ✓ Verifique limites de API do Supabase

**3. "Cron job não está executando"**
- ✓ Verifique se `pg_cron` está habilitado
- ✓ Confirme sintaxe do cron schedule
- ✓ Veja logs: `SELECT * FROM cron.job_run_details`

---

## 📊 Checklist de Validação

Antes de considerar o sistema pronto:

- [ ] Schema replicado no Supabase externo
- [ ] Secrets configurados (URL + SERVICE_KEY)
- [ ] Cron job criado e ativo
- [ ] Teste de conexão bem-sucedido
- [ ] Sync manual executado com sucesso
- [ ] Dados verificados no Supabase externo
- [ ] Logs de sync funcionando
- [ ] Interface `/admin/backup-sync` acessível
- [ ] Documentação lida e compreendida

---

## 🎉 Conclusão

Você agora tem um sistema robusto de backup automático!

- ✅ Backup a cada 12 horas
- ✅ Logs completos de cada sync
- ✅ Interface de monitoramento
- ✅ Recuperação de desastres documentada
- ✅ Zero intervenção manual necessária

**Recomendação**: Verifique `/admin/backup-sync` semanalmente para garantir que tudo está funcionando perfeitamente.
