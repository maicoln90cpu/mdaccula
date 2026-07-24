# Pendências - MDAccula

> Só itens em aberto que precisam de ação, decisão ou revisão em alguma data futura.
> **Não é changelog** — o que já foi feito vive em [`CHANGELOG.md`](CHANGELOG.md).
> **Não é roadmap** — feature nova planejada (ainda não iniciada por escolha própria) vive em [`docs/ROADMAP.md`](docs/ROADMAP.md).

**Última atualização:** 23/07/2026

---

## Como usar este documento

Cada pendência tem um tipo — isso decide onde ela deveria estar:

| Tipo | O que é | Pergunta que responde |
|------|---------|------------------------|
| 🗳️ **Decisão pendente** | Algo pronto ou quase pronto, mas travado numa escolha que só o usuário pode fazer | "O que estou esperando alguém decidir?" |
| 🔧 **Bug conhecido** | Um problema real já identificado, ainda sem correção aplicada | "O que sei que está quebrado?" |
| 👀 **Monitoramento** | Uma mudança já foi feita e entregue — falta só voltar numa data futura pra conferir o resultado | "O que preciso lembrar de checar depois?" |

Quando um item sai de "aberto" (foi decidido, corrigido, ou o monitoramento terminou), ele se torna uma entrada nova no `CHANGELOG.md` e **sai** deste arquivo — não fica registrado como "concluído" aqui.

Se o que você quer registrar é uma feature nova ainda não iniciada (não uma decisão travada, não um bug, não um checkpoint), ela vai pro `docs/ROADMAP.md`, não aqui.

---

## 👀 Monitoramento

### Checkpoint: confirmar que o prerender SEO está rodando e gerando HTML correto
**Checar em:** ~20/07/2026 (1-2 dias após o primeiro agendamento)
**Contexto:** Pipeline de prerender via GitHub Actions (`.github/workflows/prerender.yml`) implementado e testado manualmente em 19/07/2026 contra o site real (título/JSON-LD corretamente hidratados por rota) — ver entrada no [`CHANGELOG.md`](CHANGELOG.md). Falta confirmar que a primeira execução agendada (09:00 UTC / 06:00 BRT) rodou e commitou `public/_prerendered/**` de verdade.
**Passos:**
1. Conferir a aba Actions do GitHub (`.github/workflows/prerender.yml`) — a run agendada rodou sem erro?
2. Conferir se um novo commit `chore(prerender): atualiza HTML pré-renderizado [skip ci]` apareceu no histórico.
3. `curl -A "facebookexternalhit"` numa rota de evento publicada e confirmar que o HTML já vem com título/JSON-LD específicos, não o genérico da home.
**Responsável:** IA confere quando solicitado

---

### Checkpoint: confirmar redução de banda do Bunny CDN e decidir sobre Cloudflare
**Checar em:** ~02/08/2026 (15 dias após o rollout)
**Contexto:** Rollout de variantes de imagem (thumb/medium) concluído em 18/07/2026 — ver entrada no [`CHANGELOG.md`](CHANGELOG.md). Falta confirmar com tráfego real se a banda caiu como esperado.
**Passos:**
1. Rodar o botão **"Gerar Variantes para Eventos Ativos"** em `/admin/settings` → aba Mídia (ferramenta pronta, ainda não foi clicado).
2. Depois de ~15 dias de tráfego real, comparar em `/admin` → Métricas Reais → aba Bunny CDN a média de bytes/requisição contra o baseline anotado (~337KB/req, ~90GB/mês, ~$4-5/mês do item de banda).
3. Só reconsiderar Cloudflare-na-frente-do-Bunny se o custo continuar alto mesmo após a queda esperada — origin traffic do Bunny já é só 1,3% da banda total (cache já é eficiente), então o ganho do Cloudflare tende a ser baixo: ele reduziria *quem fatura* a banda, não os bytes entregues. Se o total de ~$10/mês não cair proporcionalmente, conferir também a fatura detalhada do Bunny (pode ter taxa mínima/storage não relacionado a banda).
**Responsável:** usuário revisa as métricas; IA confere se solicitado

---

### Checkpoint: Apify/Instagram aguardando post real para validar o webhook
**Checar em:** sem data fixa — depende de quando o Alataj (ou outra fonte reativada) postar algo novo
**Contexto:** validação prática em 23/07/2026 confirmou que o disparo do ator Apify funciona ponta a ponta (`instagramTriggered:1`, execuções "Succeeded" no console da Apify), mas o teste caiu em "0 resultados" (sem post novo no momento) — o `apify-instagram-webhook` (callback de quando a Apify *encontra* algo) ainda não foi exercido com um payload real. Detalhes completos em [`docs/superpowers/plans/2026-07-15-event-watcher-master-roadmap.md`](docs/superpowers/plans/2026-07-15-event-watcher-master-roadmap.md) → seção "Validação prática realizada (23/07/2026)".
**Passos:**
1. Deixar a fonte Alataj (ou reativar mais fontes) ativa até um post novo disparar o webhook de verdade.
2. Conferir em `application_logs` e `event_watch_drafts` se o rascunho foi gerado corretamente a partir de dado real.
**Responsável:** IA confere quando solicitado

---

## 🗳️ Decisões Pendentes do Usuário

### Funções `SECURITY DEFINER` executáveis por qualquer visitante anônimo
**Contexto:** advisor de segurança do Supabase (rodado em 23/07/2026) aponta ~14 funções (`has_role`, `is_admin`, `increment_event_views`, `increment_link_clicks`, `increment_post_views`, `increment_redirect_clicks`, `toggle_post_like`, `user_liked_post`, `handle_new_user`, `is_valid_email`, `is_authenticated`, `update_blog_posts_search_vector`, `cleanup_old_egress`, `cleanup_old_logs`, `get_db_size`) chamáveis via `/rest/v1/rpc/...` por usuários não autenticados.
**Por que é uma decisão, não um bug:** a maioria parece intencional (contadores públicos de clique/view, checagem de role usada pelo próprio frontend) — mas isso não foi confirmado função a função, e algumas (`get_db_size`, `cleanup_old_egress`, `cleanup_old_logs`) parecem ferramentas administrativas que talvez não devessem ser públicas.
**Decisão necessária:** revisar a lista e confirmar quais devem continuar públicas vs. quais deveriam exigir `authenticated`/`admin`. Detalhe completo: [advisor do Supabase, lint `0028`/`0029`](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

---

## 🔧 Bugs Conhecidos

### Leaked Password Protection desabilitado
**Status:** ⚠️ Desabilitado (reconfirmado pelo advisor em 23/07/2026 — já documentado desde 15/03/2026 em [`docs/SECURITY-AUDIT.md`](docs/SECURITY-AUDIT.md), nunca foi corrigido)
**Ação:** habilitar em Authentication → Providers → Email no painel do Supabase (1 clique, fora do alcance das ferramentas de código/MCP).

### 3 buckets públicos permitem listar todos os arquivos
**Status:** ⚠️ Identificado pelo advisor em 23/07/2026
**Contexto:** `event-images`, `link-thumbnails` e `team-images` têm uma policy de `SELECT` ampla em `storage.objects` que permite listar todo o conteúdo do bucket, não só acessar arquivos por URL direta (que é tudo que o site precisa). Risco baixo (são imagens já públicas por design), mas expõe mais do que o necessário.
**Correção sugerida:** restringir a policy de `SELECT` pra permitir `get`/acesso por nome, sem permitir `list` — ver [advisor do Supabase, lint `0025`](https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing).

---

## 📚 Documentos Relacionados

| Documento | Descrição | Link |
|-----------|-----------|------|
| CHANGELOG.md | Histórico do que já foi entregue | [/CHANGELOG.md](/CHANGELOG.md) |
| docs/ROADMAP.md | Features novas planejadas, fases e cronograma | [/docs/ROADMAP.md](/docs/ROADMAP.md) |
| README.md | Documentação técnica | [/README.md](/README.md) |
| docs/PRD.md | Requisitos do produto | [/docs/PRD.md](/docs/PRD.md) |
| docs/CODE_STYLE.md | Guia de código | [/docs/CODE_STYLE.md](/docs/CODE_STYLE.md) |
| docs/SECURITY-AUDIT.md | Auditoria segurança | [/docs/SECURITY-AUDIT.md](/docs/SECURITY-AUDIT.md) |
| tabelas.md | Documentação do banco | [/tabelas.md](/tabelas.md) |
