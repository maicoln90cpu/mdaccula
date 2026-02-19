

## Migrar dados do usuario antigo para o novo

### Contexto

O email `contato@mdaccula.com` tem dois registros:

| | ID | Origem |
|---|---|---|
| Antigo | `61878bfd-4e94-4b3c-ac7e-39147663f953` | Apenas na tabela `profiles` (sem conta no auth.users atual) |
| Novo | `af594fec-a149-4ff0-b65f-ba13c84359c0` | Conta recem-criada no auth.users, com profile auto-gerado |

### O que sera feito

1. **Atualizar role admin** -- mudar o `user_id` na tabela `user_roles` do ID antigo para o ID novo, para que a nova conta tenha acesso de administrador

2. **Remover profile antigo** -- deletar o registro do profile com o ID antigo, ja que o novo profile ja foi criado automaticamente

Nenhum outro dado (events, blog_posts, blog_post_likes) esta atrelado ao ID antigo, entao nao ha mais nada para migrar.

### Detalhes tecnicos

Serão executados dois comandos SQL via ferramenta de dados:

```text
UPDATE user_roles 
SET user_id = 'af594fec-a149-4ff0-b65f-ba13c84359c0' 
WHERE user_id = '61878bfd-4e94-4b3c-ac7e-39147663f953';

DELETE FROM profiles 
WHERE id = '61878bfd-4e94-4b3c-ac7e-39147663f953';
```

### Resultado esperado

Apos a execucao, a conta nova (`af594fec...`) tera:
- Profile com nome "Agencia MDAccula"
- Role de **admin** funcionando
- Login via email/senha operacional

### Riscos

Nenhum dado sera perdido -- nao ha registros em outras tabelas associados ao ID antigo.

