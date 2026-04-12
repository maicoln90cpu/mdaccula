

## Plano: Integrar Métricas do Supabase Management API no Dashboard de Egress

### O que será feito

Criar uma Edge Function que consulta a API oficial do Supabase para buscar contagem de requisições por serviço (auth, rest, storage, realtime), e exibir esses dados no dashboard de egress junto com um link direto para o painel oficial.

### Passos

| # | Tarefa | Arquivo |
|---|--------|---------|
| 1 | Adicionar secret `MANAGEMENT_API_PAT` com o token do usuário | Via ferramenta de secrets |
| 2 | Criar Edge Function `supabase-usage` | `supabase/functions/supabase-usage/index.ts` |
| 3 | Registrar na config (verify_jwt = false) | `supabase/config.toml` |
| 4 | Atualizar dashboard com card de requisições e link oficial | `src/pages/admin/EgressMonitor.tsx` |

### Detalhes técnicos

**Edge Function `supabase-usage`:**
- Chama `GET https://api.supabase.com/v1/projects/xfvpuzlspvvsmmunznxw/analytics/endpoints/usage.api-counts`
- Usa header `Authorization: Bearer {MANAGEMENT_API_PAT}`
- Aceita query params `interval` (daily/hourly) e período
- Retorna contagem de requisições por serviço (auth, rest, storage, realtime)
- Requer autenticação admin (verifica JWT do usuário chamador)

**Dashboard (`EgressMonitor.tsx`):**
- Novo card "Requisições por Serviço" com barras horizontais mostrando auth/rest/storage/realtime
- Botão/link direto para `https://supabase.com/dashboard/project/xfvpuzlspvvsmmunznxw/settings/billing/usage`
- Disclaimer atualizado explicando que egress em bytes só está disponível no dashboard oficial

### Para o usuário (linguagem simples)

**Como está:** O dashboard mostra apenas os dados que o próprio sistema consegue medir (~80-85% do tráfego real), sem comparação com dados oficiais.

**Como ficará:** O dashboard passará a mostrar também a contagem oficial de requisições do Supabase (quantas vezes cada serviço foi chamado), permitindo comparar tendências. Além disso, terá um botão que abre diretamente a página oficial de uso do Supabase para ver o egress real em GB.

**Limitação:** O Supabase não disponibiliza o volume em bytes via API — apenas contagem de requisições. O valor em GB só pode ser visto no dashboard oficial. O link direto resolve isso de forma prática.

