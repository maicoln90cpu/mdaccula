# Pendências - MDAccula

> Só itens em aberto que precisam de ação, decisão ou revisão em alguma data futura.
> **Não é changelog** — o que já foi feito vive em [`CHANGELOG.md`](CHANGELOG.md).
> **Não é roadmap** — feature nova planejada (ainda não iniciada por escolha própria) vive em [`ROADMAP.md`](ROADMAP.md).

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

_Nenhuma no momento._

---

## 🔧 Bugs Conhecidos

### Várias Edge Functions admin não têm checagem de autenticação no código
**Status:** 🔧 Não corrigido — plano de fases definido (04/08/2026, via skill `auditoria-backend`), aguardando aprovação da Fase 1 pra começar a implementar.
**Contexto:** `verify_jwt` é `false` em todas as functions do projeto (auth é responsabilidade de cada function). ~20 funções pensadas como "só admin usa" não verificam token nenhum: `send-mass-newsletter`, `import-csv-data`, `upload-csv`, `diagnose-media`, `cleanup-storage`, `batch-convert-webp`, `convert-to-webp`, `import-storage`, `fetch-link-metadata`, `systemhealth`, `generate-blog-post-v2`, `generate-blog-post-from-topic`, `generate-blog-suggestions`, `generate-multi-event-article`, `regenerate-blog-image`, `preview-topic-sources`, `auto-article-cron`, `create-recurring-events`, `cleanup-sync-logs`. O projeto já tem o mecanismo certo pronto (`authorizeAdminOrCron()` em `supabase/functions/_shared/index.ts`, aceita admin JWT + `has_role()` OU cron secret) — só falta cada function chamá-lo.
**Casos à parte** (não é "esqueceram auth", precisam de tratamento diferente):
- `send-podcast-notification` — chamada por formulário público real (`Podcast.tsx`); precisa de rate limiting (como `send-contact-email`/`request-data-deletion` já têm), não admin-auth.
- `compose-event-image` — tem 2 chamadores server-to-server sem sessão de usuário (`scan-event-sources`, `apify-instagram-webhook`); exigir admin JWT quebraria essas automações. Precisa de secret interno compartilhado, não é cópia mecânica do padrão admin.
- `import-storage` (ferramenta de migração one-off, pode já ter cumprido o papel) e `convert-to-webp` (placeholder no-op) — decidir entre proteger ou remover.
**Passos:** plano de 8 fases (detalhado na conversa de 04/08/2026) — Fase 1 (`send-mass-newsletter`, `import-csv-data`, `upload-csv`) é a de maior risco de abuso real, prioridade sugerida.
**Responsável:** usuário aprova cada fase antes da IA implementar (uma de cada vez — nunca em lote, por regra do próprio `CLAUDE.md`).

### Leaked Password Protection desabilitado
**Status:** 🚫 Não aplicável — decisão do usuário (03/08/2026)
**Contexto:** o recurso exige configuração no painel do Supabase e o projeto não tem assinatura para isso. Fica intencionalmente **OFF**; não reabrir como pendência em auditorias futuras.
**Mitigação existente:** acesso ao `/admin` é restrito por `user_roles` + `has_role()`; não há cadastro público de usuários no site.



---

## 📚 Documentos Relacionados

| Documento | Descrição | Link |
|-----------|-----------|------|
| CHANGELOG.md | Histórico do que já foi entregue | [CHANGELOG.md](CHANGELOG.md) |
| ROADMAP.md | Features novas planejadas, fases e cronograma | [ROADMAP.md](ROADMAP.md) |
| README.md | Documentação técnica | [../README.md](../README.md) |
| PRD.md | Requisitos do produto | [PRD.md](PRD.md) |
| CODE_STYLE.md | Guia de código | [CODE_STYLE.md](CODE_STYLE.md) |
| SECURITY-AUDIT.md | Auditoria segurança | [SECURITY-AUDIT.md](SECURITY-AUDIT.md) |
| DATABASE_SCHEMA.md | Índice das tabelas por domínio | [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) |
| EDGE_FUNCTIONS.md | Índice das Edge Functions | [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md) |
| tabelas.md | Documentação SQL do banco | [tabelas.md](tabelas.md) |
