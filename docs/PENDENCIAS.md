# Pendências - MDAccula

> Só itens em aberto que precisam de ação, decisão ou revisão em alguma data futura.
> **Não é changelog** — o que já foi feito vive em [`CHANGELOG.md`](CHANGELOG.md).
> **Não é roadmap** — feature nova planejada (ainda não iniciada por escolha própria) vive em [`ROADMAP.md`](ROADMAP.md).

**Última atualização:** 10/08/2026

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

### Checkpoint: acompanhar as próximas execuções reais da Geração por Tema (Fase 1)
**Checar em:** próximos 3-5 ciclos do cron (a cada intervalo configurado, hoje 48h) ou próximas vezes que "Forçar Geração Agora" for usado
**Contexto:** Fase 1 (pipeline estrito 1-fonte-1-matéria, R-048) teve 3 hotfixes consecutivos no mesmo dia do deploy — página de listagem escolhida como matéria (Play BPM), plataforma de ticketing escolhida como fonte (Sympla), página utilitária escolhida como matéria (House Mag/login). Os 3 casos foram corrigidos, mas o padrão sugere que a estrutura de link de cada fonte real ainda não foi totalmente validada contra o filtro de descoberta.
**Passos:**
1. Depois de cada geração automática (forçada ou pelo cron), abrir `/admin/blog` e conferir se o artigo gerado corresponde de fato a uma matéria real existente na fonte (a URL em `ai_generated_posts.source_urls` bate com uma matéria específica, não homepage/listagem/institucional).
2. Se aparecer outro `skipped-source-article-unusable` ou `skipped-no-new-articles` nos logs (`application_logs`, filtro `Auto-geração`) sem nenhum artigo saindo, reportar a URL/fonte específica pra eu ajustar o filtro — mesmo padrão dos 3 hotfixes anteriores.
3. Depois de 3-5 ciclos limpos (artigo real gerado, ou skip legítimo sem URL estranha), este checkpoint pode ser encerrado.
**Responsável:** usuário reporta o que encontrar; IA ajusta

### Checkpoint: `event_sources.content_source` do WeGoOut voltou pra `true` sozinho — causa raiz não confirmada
**Checar em:** próximas 2 semanas — conferir semanalmente se algum artigo saiu de Sympla/Ingresse/WeGoOut de novo
**Contexto:** em 09/08/2026, corrigi `content_source=false` pras 3 plataformas de ticketing (Sympla, Ingresse, WeGoOut) às 00:22 UTC (confirmado por SELECT logo em seguida). Por volta de 00:34 UTC — 12 minutos depois, sem eu ter rodado nenhum UPDATE nesse intervalo — o `WeGoOut` (só ele, Sympla/Ingresse continuaram corretos) tinha voltado pra `content_source=true`, e o `auto-article-cron` gerou um rascunho reescrevendo uma página de evento do WeGoOut como se fosse notícia (mesmo padrão do bug original). Busquei em todo o código por qualquer INSERT/UPDATE que grave `content_source` — só achei `FontesManager.tsx` (client-side, exige ação manual de um admin no `/admin/fontes`) e as duas queries de leitura (`auto-article-cron`, `generate-blog-suggestions`). Nenhum cron/webhook/trigger no banco escreve nessa coluna. Corrigido de novo às 01:29 UTC (confirmado). Não consegui confirmar a causa raiz — pode ter sido uma edição real no `/admin/fontes` (o toggle novo da coluna "Conteúdo" foi ao ar nesse mesmo commit) enquanto eu testava, ou algo que não encontrei.
**Passos:**
1. Rodar `select name, type, content_source, updated_at from event_sources where name in ('Sympla','Ingresse','WeGoOut') and type='site';` — as 3 devem estar `false`. Se alguma voltar `true` sem explicação (ninguém mexeu no toggle em `/admin/fontes`), é sinal de um bug real ainda não encontrado — me avisar.
2. Se acontecer de novo, checar `updated_at` de cada linha pra ver se bate com uma sessão de edição manual conhecida.
**Responsável:** usuário confere periodicamente; IA investiga mais fundo se voltar a acontecer

---

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

### Checkpoint: primeiro ciclo real de Digest semanal / Agenda do FDS com registro de histórico ligado
**Checar em:** ~11/08/2026 (terça — Digest semanal) e ~13/08/2026 (quinta — Agenda do FDS)
**Contexto:** o registro de histórico dessas 2 automações em `event_email_campaigns` (via `writeDigestCampaignHistory`) foi ligado em 08/08/2026 — mas como cada uma só roda 1x por semana (terça e quinta), nenhuma teve chance de rodar ainda. O envio de e-mail em si funciona há tempos (confirmado pelo usuário); só a parte de aparecer no Dashboard é nova. Não é bug — só falta o primeiro ciclo pra confirmar que a linha é gravada como esperado.
**Passos:**
1. Depois de terça (Digest semanal) e quinta (Agenda do FDS), conferir em `/admin/email-config` → Dashboard se as duas aparecem.
2. Se alguma não aparecer, checar `event_email_campaigns` direto no banco (`campaign_type` = `weekly_digest`/`weekend_agenda`) pra ver se a linha foi gravada com erro, ou se não foi gravada de jeito nenhum (nesse caso, investigar por que `writeDigestCampaignHistory` não completou).
**Responsável:** IA confere quando solicitado

---

### Checkpoint: primeiro envio de Blog news com registro de histórico ligado
**Checar em:** 09/08/2026, ~16h UTC (13h BRT) — próximo disparo do cron `blog-digest-cron`
**Contexto:** `blog-digest-draft` passou a chamar `writeDigestCampaignHistory()` em 09/08/2026 (ver `CHANGELOG.md`), poucas horas antes do disparo semanal (domingo). É o primeiro teste real dessa gravação — o envio de e-mail em si não foi alterado, só o registro depois.
**Passos:**
1. Depois do disparo, conferir em `/admin/email-config` → Dashboard/Histórico se "Blog news" aparece.
2. Se não aparecer, checar `event_email_campaigns` (`campaign_type = 'blog_digest'`) — se a linha não existe, o insert falhou silenciosamente (o e-mail ainda teria sido enviado normalmente, já que a gravação acontece depois).
**Responsável:** IA confere quando solicitado

---

### 🔧 Bug conhecido: causa raiz Postgres da falha de gravação em `event_email_campaigns` ainda não identificada
**Status:** correção de diagnóstico implantada (R-058) — o erro agora é visível, mas a causa exata (RLS? grant? constraint?) ainda depende do próximo disparo real pra aparecer no log/resposta.
**Contexto:** investigação só-leitura (logs + SQL) de 10/08/2026 provou que o disparo do evento Sirius NÃO estava travando nem dando exceção — completava em 2-3s com HTTP 200 — mas o claim anti-duplo-clique ficava preso e nenhuma linha era gravada em `event_email_campaigns`. Rastreamento do código mostrou que o único caminho consistente com essas evidências é `created.ok === true` (E-goi aceitou criar a campanha) seguido de uma falha silenciosa no `.update()`/`.insert()` final do histórico — o `{ error }` do Supabase-js nunca era checado. Checagens estáticas já feitas (não confirmaram a causa): colunas/tipos do `rowPayload` batem com o schema, `CHECK` constraints (`mode`, `status`) são satisfeitos pelos valores computados, não há trigger/rule bloqueando, e a policy RLS pra `service_role` (`using(true) with check(true)`) deveria ser totalmente permissiva — mas isso não foi testado com uma escrita real (só leitura, por estar em modo de planejamento no momento da investigação).
**Passos:**
1. Pedir pro usuário repetir 1 disparo real (rascunho já basta) depois do deploy do R-058.
2. Ler os logs (`edge-function-runtime`, `get_logs`) e/ou a resposta na tela — agora deve trazer a mensagem real do Postgres (código de erro tipo `42501`=permissão/RLS, `23502`/`23514`=constraint, etc.).
3. Corrigir a causa raiz específica conforme o erro indicar (pode envolver ajustar a policy, um grant, ou a migration travada — ver checkpoint abaixo).
**Responsável:** usuário reporta o resultado do próximo disparo; IA corrige a causa raiz assim que o erro real aparecer.

---

### 👀 Checkpoint: branch de produção com `status: MIGRATIONS_FAILED` — checar se está relacionado ao R-058
**Checar em:** junto com a investigação da causa raiz do R-058 acima
**Contexto:** bem no início da investigação do disparo do Sirius (ainda na fase do R-053), `list_branches` mostrou o branch padrão/produção do projeto (`project_ref: xfvpuzlspvvsmmunznxw`) com `status: "MIGRATIONS_FAILED"`. Nunca foi totalmente descartado como relacionado — é plausível que alguma migration travada tenha deixado RLS/grants de `event_email_campaigns` num estado diferente do esperado, sem afetar `events` (que tem suas próprias policies e continua funcionando normalmente para o mesmo client admin).
**Passos:**
1. Rodar `list_branches`/`list_migrations` de novo e identificar qual migration específica está travada/falhou.
2. Conferir se o DDL dessa migration toca `event_email_campaigns` (RLS, grants, constraints) — se sim, correlacionar com a mensagem de erro real capturada pelo R-058.
3. Se não tiver relação nenhuma com `event_email_campaigns`, decidir separadamente (com o usuário) se vale a pena investigar/corrigir esse branch travado por outros motivos, mas sem misturar com este bug.
**Responsável:** IA confere junto com a investigação do R-058

---

### Bug latente: outras 4 Edge Functions têm cópia própria de `egoiRequest` sem timeout (mesma classe do R-057)
**Status:** 🔧 Não corrigido — achado como efeito colateral da investigação do R-057, fora do escopo do disparo manual. Continua válido como hardening mesmo depois do R-058 mostrar que não era a causa raiz do bug do Sirius.
**Contexto:** `blog-digest-draft`, `send-event-reminder-campaigns`, `weekly-digest-draft` e `weekend-agenda-draft` cada uma tem sua PRÓPRIA implementação local de `egoiRequest` (não usam o `_shared/egoiClient.ts`), com o mesmo `fetch()` sem timeout que o R-057 corrigiu no compartilhado. Nenhuma delas usa segmento por disparo hoje (só o fluxo manual tem esse campo), então o risco é menor, mas a mesma classe de trava indefinida existe se algum dia usarem segment_id ou a E-goi tiver uma lentidão pontual.
**Correção sugerida:** ou aplicar o mesmo `AbortSignal.timeout` nas 4 cópias locais, ou (melhor, resolve a duplicação também) migrar as 4 functions pra usar `_shared/egoiClient.ts` em vez de reimplementar `egoiRequest`.
**Responsável:** decisão do usuário sobre prioridade — não é uma falha ativa reportada, é prevenção.

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

### Deploy da Edge Function `mcp` falha com 413 (bundle de 26MB)
**Status:** 🔧 Contornado (04/08/2026) — pipeline não trava mais, mas a function `mcp` em si segue sem deploy até a causa raiz ser corrigida.
**Contexto:** `supabase/functions/mcp/index.ts` é auto-gerado por `@lovable.dev/mcp-js@0.24.0`, que traz `esbuild` como dependência direta (não dev). O bundler do Deno inclui os binários nativos do esbuild no pacote final (~26MB) — a API do Supabase rejeita com `413 request entity too large`. Como `.github/workflows/deploy-edge-functions.yml` deployava tudo num comando só (`supabase functions deploy` sem argumentos, ordem alfabética), essa falha derrubava o deploy de TODA function cujo nome vem depois de "mcp" alfabeticamente (`send-mass-newsletter`, `upload-csv`, `sitemap`, `systemhealth`, `track-*`, `weekly/weekend-digest-draft` etc.) — um bug de infraestrutura sério, presente desde antes desta auditoria, achado ao tentar deployar a Fase 1 da correção de auth.
**Mitigação aplicada:** workflow dividido em 2 passos — todas as functions exceto `mcp` deployam juntas (sem risco de bloqueio); `mcp` deploya isolada com `continue-on-error: true`, então se falhar só ela fica desatualizada, sem travar as outras 56.
**Passos pra correção definitiva:** avaliar se `defineMcp`/`defineTool` do `@lovable.dev/mcp-js` têm uma forma de importar só o runtime (sem puxar `esbuild`) — ou reescrever `mcp/index.ts` à mão (tomando posse do arquivo removendo o banner "AUTO-GENERATED", conforme o próprio comentário do arquivo permite) implementando os 3 tools (`list_upcoming_events`, `get_event`, `list_blog_posts`) direto com `@supabase/supabase-js`, sem depender do framework de build da lib.
**Responsável:** decisão do usuário sobre qual caminho (esperar fix upstream vs. reescrever à mão), depois IA implementa.

### Várias Edge Functions admin não têm checagem de autenticação no código
**Status:** 🔧 Fase 1 de 8 concluída (04/08/2026) — `send-mass-newsletter`, `import-csv-data` e `upload-csv` já exigem admin autenticado em produção (confirmado por contract tests). Fases 2-8 (~17 functions restantes) ainda abertas.
**Contexto:** `verify_jwt` é `false` em todas as functions do projeto (auth é responsabilidade de cada function). Funções ainda sem checagem, pensadas como "só admin usa": `diagnose-media`, `cleanup-storage`, `batch-convert-webp`, `convert-to-webp`, `import-storage`, `fetch-link-metadata`, `systemhealth`, `generate-blog-post-v2`, `generate-blog-post-from-topic`, `generate-blog-suggestions`, `generate-multi-event-article`, `regenerate-blog-image`, `preview-topic-sources`, `auto-article-cron`, `create-recurring-events`, `cleanup-sync-logs`. O padrão usado na Fase 1 (`authorizeAdminOrCron()` em `supabase/functions/_shared/index.ts`) é reaproveitável nas próximas.
**Casos à parte** (não é "esqueceram auth", precisam de tratamento diferente):
- `send-podcast-notification` — chamada por formulário público real (`Podcast.tsx`); precisa de rate limiting (como `send-contact-email`/`request-data-deletion` já têm), não admin-auth.
- `compose-event-image` — tem 2 chamadores server-to-server sem sessão de usuário (`scan-event-sources`, `apify-instagram-webhook`); exigir admin JWT quebraria essas automações. Precisa de secret interno compartilhado, não é cópia mecânica do padrão admin.
- `import-storage` (ferramenta de migração one-off, pode já ter cumprido o papel) e `convert-to-webp` (placeholder no-op) — decidir entre proteger ou remover.
**Passos:** Fases 2-8 do plano original (detalhado na conversa de 04/08/2026), uma por vez com aprovação antes de cada uma.
**Responsável:** usuário aprova cada fase antes da IA implementar (uma de cada vez — nunca em lote, por regra do próprio `CLAUDE.md`).

### `egoi-curl-probe` continua deployada (era pra ser descartável)
**Status:** 🔧 Não corrigido — achado em 09/08/2026 durante auditoria de documentação.
**Contexto:** o próprio comentário do arquivo (`supabase/functions/egoi-curl-probe/index.ts:1-3`) diz "Edge function descartável — validar API E-goi antes de codar a integração... Após validar, esta função pode ser deletada." A validação já foi feita há tempos (o header `Apikey` correto já está em uso em todo o resto da integração E-goi), mas a function nunca foi removida — segue deployada e sem nenhuma checagem de auth (`verify_jwt: false` + sem validação no código), expondo a `EGOI_API_KEY` pra qualquer request a `/lists` e `/senders` de quem descobrir a URL.
**Correção sugerida:** apagar `supabase/functions/egoi-curl-probe/` (pasta inteira) e a entrada `[functions.egoi-curl-probe]` em `supabase/config.toml`.
**Responsável:** decisão do usuário — é uma remoção simples, mas envolve apagar código, por isso não fiz sem confirmar.

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
