

## Diagnostico: Geracao Automatica Parada

### Problema Principal Encontrado

A funcao `auto-article-cron` **nunca e chamada automaticamente** porque **nao existe nenhum cron job configurado** no banco de dados. As extensoes `pg_cron` e `pg_net` nao estao instaladas.

A funcao Edge Function existe e funciona, mas ela depende de algo que a chame periodicamente. Sem o cron job, ela so executa quando voce clica em "Forcar Geracao Agora".

### Evidencias

| Verificacao | Resultado |
|-------------|-----------|
| Extensao `pg_cron` instalada | NAO |
| Extensao `pg_net` instalada | NAO |
| Tabela `cron.job` existe | NAO |
| Logs da Edge Function `auto-article-cron` | NENHUM log encontrado |
| Logs de "Auto-geracao" no `application_logs` | NENHUM registro |
| `ai_auto_generate_last_run` | `2026-02-19T00:00:04.282Z` (4 dias atras, provavelmente de um clique manual) |
| `ai_auto_generate_fail_count` | 0 |
| `ai_auto_generate_enabled` | true |

### Correcao Necessaria

#### Passo 1: Habilitar extensoes `pg_cron` e `pg_net`

Criar uma migracao SQL para habilitar as duas extensoes necessarias para agendar chamadas HTTP periodicas.

#### Passo 2: Criar o cron job

Configurar um cron job que chame a Edge Function `auto-article-cron` periodicamente (a cada 1 hora). A funcao ja possui a logica interna para verificar se o intervalo de 48h passou, entao chamar a cada hora e seguro -- ela simplesmente retorna "skipped" quando nao e hora de gerar.

```text
Frequencia: a cada 1 hora (* */1 * * *)
Alvo: POST para /functions/v1/auto-article-cron
Headers: Authorization Bearer + anon key
```

#### Passo 3 (opcional): Melhorar visibilidade no dashboard

O dashboard mostra "Nenhum log de execucao encontrado" porque a funcao nunca rodou automaticamente. Apos ativar o cron, os logs comecam a aparecer.

### Detalhes Tecnicos

**Arquivo criado:** Nova migracao SQL

```text
1. CREATE EXTENSION IF NOT EXISTS pg_cron
2. CREATE EXTENSION IF NOT EXISTS pg_net
3. SELECT cron.schedule(
     'auto-article-cron',
     '0 * * * *',  -- a cada hora cheia
     POST para SUPABASE_URL/functions/v1/auto-article-cron
     com Authorization header
   )
```

**Nenhum arquivo TypeScript precisa ser alterado** -- a Edge Function ja esta correta, so precisa ser chamada.

### Por que a "ultima execucao" mostra 4 dias atras?

Provavelmente foi um clique manual no botao "Forcar Geracao Agora" em 18/02. Como nao ha cron, nunca mais foi chamada automaticamente.

