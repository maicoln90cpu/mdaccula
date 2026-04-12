

## Diagnostico: Supabase NAO expoe dados de egress via API publica

### O que foi investigado

Analisei em detalhe toda a API publica do Supabase (OpenAPI spec em `api.supabase.com/api/v1-json`) e os logs de analytics disponiveis. Resultado:

1. **Nao existe endpoint de egress na Management API** — os unicos endpoints de "usage" retornam **contagem de requisicoes** (auth, realtime, rest, storage), NAO bytes transferidos
2. **Os logs de analytics (edge_logs) nao incluem tamanho da resposta** — a metadata tem method, path, status_code, headers, mas NAO tem `response.size` ou `content_length` da resposta
3. **O numero "7.42 GB" do dashboard vem de sistemas internos de billing** do Supabase (BigQuery/infraestrutura) que nao sao expostos via API

### O que e possivel fazer (alternativas reais)

**Opcao A — Contagem de requisicoes como proxy (viavel agora)**
Usar `GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts` com um PAT (Personal Access Token) para buscar o volume de requisicoes por servico (auth, rest, storage, realtime). Nao e egress em bytes, mas permite comparar tendencias e volume.

**Opcao B — Estimar via logs com SQL customizado (viavel agora)**
Usar `GET /v1/projects/{ref}/analytics/endpoints/logs.all` com queries SQL customizadas para contar requisicoes por path/metodo/status. Combinando com o tamanho medio de resposta medido pelo nosso Service Worker, podemos calcular uma estimativa.

**Opcao C — Disclaimer no dashboard (recomendado)**
Manter o sistema atual (que ja cobre ~80-85% do trafego real) e adicionar no dashboard:
- Um card mostrando que os dados oficiais do Supabase so estao disponiveis em `supabase.com/dashboard > Usage`
- Link direto para a pagina de usage do Supabase
- A contagem de requisicoes via API (Opcao A) como metrica complementar

### Plano recomendado

| Passo | O que fazer |
|-------|------------|
| 1 | Criar Edge Function `supabase-usage` que usa PAT para buscar contagem de requisicoes da Management API |
| 2 | Adicionar card no EgressMonitor com "Requisicoes por Servico" (auth, rest, storage, realtime) direto do Supabase |
| 3 | Adicionar link direto para o dashboard oficial do Supabase (`https://supabase.com/dashboard/project/xfvpuzlspvvsmmunznxw/settings/billing/usage`) |
| 4 | Adicionar nota explicando que egress em bytes nao e disponivel via API e so pode ser visto no dashboard oficial |

### Pre-requisito
Voce precisara gerar um **Personal Access Token (PAT)** no Supabase em `supabase.com/dashboard/account/tokens` e adicioná-lo como secret (`SUPABASE_PAT`).

### Decisao necessaria
Quer prosseguir com essa abordagem (contagem de requisicoes + link para dashboard oficial)? Ou prefere manter apenas o disclaimer simples explicando a limitacao da API?

