# Pendências - MDAccula

> Só itens em aberto que precisam de ação, decisão ou revisão em alguma data futura.
> **Não é changelog** — o que já foi feito vive em [`CHANGELOG.md`](CHANGELOG.md).
> **Não é roadmap** — feature nova planejada (ainda não iniciada por escolha própria) vive em [`ROADMAP.md`](ROADMAP.md).

**Última atualização:** 15/08/2026

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

## 🔧 Bug conhecido

### Checagem de Storage no egress-alert-cron: credencial OK, mas a API pública de Analytics do Supabase está devolvendo erro consistentemente
**Contexto:** decisão tomada em 12/08/2026 (ver R-061 no `CHANGELOG.md`) — implementadas as opções 2 e 3 pra fechar o ponto cego do monitor de egress pra Supabase Storage/CDN. Histórico de investigação, na ordem:
1. `METRICS_API_KEY` (secret antigo) não era um PAT válido (401 "JWT could not be decoded").
2. Descoberto na prática: o Supabase **bloqueia** nomes de secret de Edge Function contendo "SUPABASE" — por isso `SUPABASE_MANAGEMENT_API_TOKEN` nunca teria funcionado. Usuário gerou um token novo, salvou como `MANAGEMENT_API_TOKEN`.
3. Com o novo token, a autenticação passou a funcionar (sem mais 401) — mas a chamada para `https://api.supabase.com/v1/projects/{ref}/analytics/endpoints/logs.all` passou a devolver `200 OK` com `{"result":null,"error":"Backend error! Retry your query. Please contact support if this continues."}`.
4. Código ajustado pra detectar esse campo `error` explicitamente (antes era lido como "0 linhas" silenciosamente) e tentar de novo — primeiro 1 retry, depois 3 tentativas com 1,2s de espera. **Falhou 100% das vezes em 2 rodadas completas (6 tentativas no total, ~4 minutos), sempre com a mesma mensagem.**
5. Comparação: a mesma consulta SQL exata (`select count(*) as cnt from logs where source = 'storage_logs'`), no mesmo momento, funcionou normalmente via MCP (`query_logs`) — sugere que o caminho usado pelo MCP (provavelmente uma sessão/API interna do Supabase, não a API pública de Management com PAT) é mais confiável do que o endpoint público que a Edge Function usa. Não é algo que mais tentativas dentro de uma mesma chamada resolvem — parece uma diferença real de confiabilidade entre os dois caminhos de acesso, não azar pontual.
**Estado atual:** a credencial e o código estão corretos e testados; a checagem de Storage continua degradando graciosamente (não quebra o alarme — `ok: true` sempre, `ver R-049`), só não traz o dado extra ainda. O cron real roda 2x/dia (09h e 12h UTC) — cada execução é uma nova tentativa independente, então pode "pegar" um momento em que a API pública do Supabase esteja estável.
**Passos:**
1. Monitorar por alguns dias se alguma execução automática do cron traz `storage_requests_24h` != `null` (dá pra conferir em `egress_alerts.details` ou nos logs de `function_logs`).
2. Se continuar falhando sempre, considerar reportar o erro pro suporte do Supabase (a própria mensagem de erro já sugere isso) ou aceitar que essa checagem específica fica só como bônus oportunista, sem depender dela — a correção da causa raiz (R-061) já está no ar e não depende disso.
**Responsável:** IA monitora quando solicitado; não é bloqueante pra mais nada.

### Risco residual do R-062: janela estreita onde o cron de limpeza pode liberar um evento que na verdade já teve campanha criada na E-goi
**Contexto:** a correção do R-062 (ver `CHANGELOG.md`) fechou a lacuna principal — uma linha `event_email_campaigns` só fica em `in_progress` (o estado que o cron `heal-stuck-email-dispatches` considera "seguro pra liberar") ANTES de qualquer chamada à E-goi. Mas ainda existe uma janela estreita: se a Edge Function morrer bem NO MEIO da chamada à E-goi (depois de enviar a requisição, antes de receber/processar a resposta), não há como saber se a E-goi recebeu e processou o pedido ou não. Nesse caso raro, o cron de limpeza liberaria a reserva achando que nada foi criado, quando pode ter sido — permitindo, em tese, uma recriação/duplicação.
**Por que não foi resolvido agora:** resolver isso por completo exigeria a E-goi suportar uma chave de idempotência no payload de criação de campanha (pra a mesma requisição, reenviada, nunca criar 2 campanhas) — a API v3 da E-goi não parece expor esse recurso hoje.
**Mitigação existente:** a janela é muito menor que antes (só durante a chamada de rede em si, não o processo inteiro entre claim e confirmação) e o timeout de 25s em `egoiRequest`/`sendEgoiCampaign` limita seu tamanho máximo. Um evento que passa por essa janela específica muito raramente teria, na pior hipótese, uma campanha duplicada criada na E-goi (nunca um envio duplicado silencioso sem rastro — o histórico sempre registra as duas tentativas).
**Passos (se algum dia quiser fechar de vez):** avaliar com a E-goi se existe algum campo de idempotência não documentado, ou aceitar o risco residual (avaliação atual: baixo, dado o tamanho da janela).
**Responsável:** decisão do usuário sobre prioridade — não é uma falha ativa, é um risco residual conhecido e documentado.

## 👀 Monitoramento

### Checkpoint: chave antiga do Google Maps continua ativa e exposta publicamente — aguardando o Lovable revogar
**Checar em:** a cada vez que o usuário confirmar uma resposta do suporte/Discord do Lovable, ou a cada poucos dias enquanto não houver resposta.
**Contexto:** 15/08/2026 — GitHub Secret Scanning (ativado nesta mesma auditoria) encontrou a chave `AIzaSyBmvJph4LmrbtW7skeczzpBIyb9WWzFKo4` num commit antigo do `.env` (variável `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`), marcada `publicly_leaked: true`. Testada diretamente contra a API do Google Static Maps via `curl` sem nenhum header de referrer — respondeu `200 OK` com uma imagem PNG válida (18.438 bytes, headers legítimos do Google), confirmando que está **ativa de verdade**, não é só um registro morto no histórico. O usuário procurou essa chave no próprio Google Cloud Console e não encontrou — o prefixo da variável (`VITE_LOVABLE_CONNECTOR_...`) sugere fortemente que ela foi provisionada pelo sistema de Connectors do Lovable (projeto Google Cloud gerenciado por eles), não pela conta pessoal do usuário, o que explica por que ele não tem acesso pra revogar. O usuário tentou excluir mesmo assim (não achou o item exato) e retestou — sem efeito, continua `200 OK` mesmo depois de mais de uma hora (afasta a hipótese de simples atraso de propagação do Google, que costuma ser de minutos). Prompt completo já foi entregue ao usuário pra enviar ao suporte do Lovable, pedindo confirmação de que a chave pertence ao connector deles e a revogação.
**Passos:**
1. Testar de novo com `curl` (`https://maps.googleapis.com/maps/api/staticmap?center=Sao+Paulo&zoom=10&size=200x200&key=AIzaSyBmvJph4LmrbtW7skeczzpBIyb9WWzFKo4`) sempre que o usuário confirmar uma resposta do Lovable — sucesso da revogação = a chamada passa a responder erro (`REQUEST_DENIED`/"invalid API key"), não mais `200 OK`.
2. Depois de confirmada a revogação, encerrar este checkpoint (vira entrada no `CHANGELOG.md`).
3. Reescrever o histórico do Git (`git filter-repo` ou similar) só faz sentido depois da revogação confirmada — antes disso é só cosmético, a chave exposta já deve ser tratada como comprometida independente do histórico.
**Responsável:** usuário aciona o suporte do Lovable; IA reconfirma com teste direto quando solicitado.

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

### 👀 Checkpoint: branch de produção com `status: MIGRATIONS_FAILED` — confirmado SEM relação com o bug do disparo manual de e-mail
**Checar em:** quando o usuário quiser investigar o branch em si (não é mais bloqueante pra nada)
**Contexto:** bem no início da investigação do disparo do Sirius (fase do R-053), `list_branches` mostrou o branch padrão/produção do projeto (`project_ref: xfvpuzlspvvsmmunznxw`) com `status: "MIGRATIONS_FAILED"`. Chegou a ser cogitado como relacionado (RLS/grants de `event_email_campaigns` num estado inesperado), mas o R-059 achou e confirmou a causa raiz real do `dispatch_in_progress` (comportamento do PostgREST reaplicando o filtro do claim sobre o valor recém-gravado — nada a ver com RLS, grants ou migrations) — então esse branch fica como um item de infraestrutura independente, sem urgência ligada a este bug.
**Passos (se/quando o usuário quiser resolver):**
1. Rodar `list_branches`/`list_migrations` de novo e identificar qual migration específica está travada/falhou.
2. Decidir com o usuário se vale corrigir esse branch (aplicar/reverter a migration travada) por motivos próprios, independente do disparo de e-mail.
**Responsável:** decisão do usuário sobre prioridade — não é uma falha ativa impactando nada em produção hoje.

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

### Definir `CRON_SHARED_SECRET` novo no painel do Supabase (repositório ficou público em 15/08/2026)
**Contexto:** o repositório foi tornado público em 15/08/2026 (pra usar o plano gratuito do GitHub Actions). Auditoria de segurança feita na sequência achou o segredo compartilhado `CRON_SHARED_SECRET` — usado como autenticação de várias Edge Functions de cron (`metrics-snapshot`, e como checagem primária em `weekly-digest-draft`, `blog-digest-draft`, `weekend-agenda-draft`, `send-event-reminder-campaigns`, `send-scheduled-email-campaigns`, `heal-stuck-email-dispatches`, `egoi-campaign-stats`) — gravado em texto puro numa migration antiga (`20260510172108_...sql`), agora visível pra qualquer pessoa no histórico do Git.
**O que já foi feito:** um valor novo já foi gerado e o cron `daily-metrics-snapshot` (o único que embute esse valor diretamente, sem passar pela tabela `internal_cron_secrets`) já foi atualizado no banco pra usar o valor novo. O valor foi entregue direto pro usuário no chat — nunca gravado em nenhum arquivo do repositório, pra não repetir o mesmo erro.
**Passos:**
1. Definir o secret `CRON_SHARED_SECRET` no painel do Supabase (Edge Functions → Secrets) ou via CLI (`supabase secrets set CRON_SHARED_SECRET=<valor combinado no chat>`) com o valor novo.
2. Até isso ser feito, o cron `daily-metrics-snapshot` (métricas diárias, não crítico) vai falhar de autenticação — os outros crons não são afetados, porque cada um usa seu próprio segredo em `internal_cron_secrets` (já rotacionados) como caminho principal.
3. Depois de confirmar que o `daily-metrics-snapshot` voltou a rodar sem erro (`function_logs`), este item pode ser encerrado.
**Responsável:** usuário (só ele tem acesso ao painel de secrets do Supabase).

### Rotacionar `apify_instagram_webhook` e reconfigurar o webhook correspondente na Apify
**Contexto:** mesma auditoria de 15/08/2026 — o segredo `apify_instagram_webhook` (usado por `apify-instagram-webhook/index.ts` pra validar que a chamada realmente veio da Apify) também está gravado em texto puro numa migration (`20260717150000_apify_instagram_webhook_secret.sql`), agora pública. Diferente dos outros 8, **não foi rotacionado** nesta rodada porque trocar o valor no banco sozinho quebraria a integração real — o mesmo valor precisa ser atualizado do lado da Apify (configuração do ator/webhook) ao mesmo tempo, e isso só o usuário consegue fazer (acesso à conta Apify).
**Passos:**
1. Gerar um valor novo.
2. Atualizar `internal_cron_secrets.apify_instagram_webhook` no Supabase.
3. Atualizar o mesmo valor na configuração do webhook do ator na Apify.
4. Testar com um post novo (ou disparo manual) pra confirmar que o webhook ainda autentica.
**Responsável:** usuário decide quando fazer (não é urgente — o pior cenário é alguém conseguir chamar esse endpoint de fora, que só aceita payloads do formato esperado da Apify e não expõe nada sensível sozinho).

### Confirmar cota diária + alerta de orçamento nas duas chaves novas do Google Maps
**Contexto:** a chave única de 6 APIs foi separada em duas (15/08/2026, ver R-063 em `docs/TESTING.md`): uma **pública** (browser, só Maps Embed API, restrição de referrer aplicada a `mdaccula.com`, `www.mdaccula.com` e `mdaccula.lovable.app`, sem `localhost`) e uma **de servidor** (nova, só Static Maps + Geocoding, restrição de app "Nenhuma" — a Geocoding API rejeita restrição de referrer — usada só via `GOOGLE_MAPS_API_KEY` no Supabase, nunca exposta). As duas foram testadas direto contra o Google e confirmadas funcionando (200/OK). `render-static-map`/`geocode-event` também pararam de depender do gateway do Lovable, que estava devolvendo "Credential not found" depois da troca de chave.
**Já feito:** restrição de app das duas chaves, escopo de API mínimo nas duas (removido Static Maps/Geocoding/JS/Android SDK/Places da chave pública; removido tudo exceto Static Maps/Geocoding da chave de servidor).
**Ainda falta:**
1. Cota diária em cada chave (Google Cloud Console → APIs & Services → Quotas & System Limits) — é o que garante um teto de gasto matematicamente certo, não só um aviso.
2. Alerta de orçamento (Billing → Budgets & alerts) — vale criar sem filtrar por serviço específico (o filtro de "Serviços" só lista o que já tem histórico de cobrança registrado nesse projeto/billing; tentar achar "Maps" ali é uma armadilha — um orçamento pro projeto inteiro cobre tudo, incluindo Maps, sem esse problema).
**Responsável:** usuário (acesso ao Google Cloud Console).

### Atualizar `react-router`/`react-router-dom` de 6.30 para 7.x (vulnerabilidade moderada, correção é breaking change)
**Contexto:** rodando o pipeline de CI inteiro em 15/08/2026 (a pedido do usuário, aproveitando o repositório ainda público), o job "Security Audit" (existente, mas com `continue-on-error: true` — nunca bloqueou merge) apontou 2 CVEs moderadas em `react-router` (open redirect via backslash em `<Link>`/`useNavigate`, injeção de construtor via `deserializeErrors()` no SSR) — ver R-069 em `docs/CHANGELOG.md`. `npm audit fix` sozinho não resolve; precisa de `--force`, que instalaria `react-router-dom@7.18.2` — salto de versão major (v6 → v7) com mudanças reais de comportamento, não é seguro aplicar às cegas num projeto com rotas lazy-loaded em praticamente toda página admin.
**Já feito (etapa 1 de 2, 15/08/2026):** auditoria do Lovable confirmou o escopo real — 58 arquivos importam do router, só 1 rota splat (`path="*"` do NotFound, `src/App.tsx`, sem rotas relativas dentro dela), nenhum uso de `createBrowserRouter`/loaders/actions/fetchers (só `<Routes>`/`<Route>` clássico). Das 6 future flags que viram padrão na v7, só 2 afetam este projeto de verdade: `v7_startTransition` (por causa do lazy loading pesado — pode mudar o timing de quando o fallback do `Suspense` aparece numa troca de rota) e `v7_relativeSplatPath` (impacto quase nulo aqui). Ativadas as duas no `<BrowserRouter future={{...}}>` (`src/App.tsx`) ainda na v6.30 — separa "mudança de comportamento" de "mudança de versão", pra saber exatamente qual das duas causou algo se aparecer um problema. Testado manualmente (dev local): navegação admin, troca de rota lazy, voltar/avançar do navegador, deep-link direto numa rota lazy (`/admin/email-config`) e a rota 404/splat — sem erro no console, sem regressão visível. `tsc`/testes automatizados também verdes.
**Ainda falta (etapa 2 — o bump de versão em si):** aplicar `npm audit fix --force` (ou `npm install react-router-dom@7`) numa branch separada, rodar a suíte completa de novo, e repetir a mesma validação manual acima antes de mergear.
**Responsável:** decisão do usuário — é uma atualização de dependência de peso real, não uma correção pontual.

---

## 🔧 Bugs Conhecidos

### Deploy da Edge Function `mcp` falha com 413 (bundle de 26MB)
**Status:** 🔧 Contornado (04/08/2026) — pipeline não trava mais, mas a function `mcp` em si segue sem deploy até a causa raiz ser corrigida.
**Contexto:** `supabase/functions/mcp/index.ts` é auto-gerado por `@lovable.dev/mcp-js@0.24.0`, que traz `esbuild` como dependência direta (não dev). O bundler do Deno inclui os binários nativos do esbuild no pacote final (~26MB) — a API do Supabase rejeita com `413 request entity too large`. Como `.github/workflows/deploy-edge-functions.yml` deployava tudo num comando só (`supabase functions deploy` sem argumentos, ordem alfabética), essa falha derrubava o deploy de TODA function cujo nome vem depois de "mcp" alfabeticamente (`send-mass-newsletter`, `upload-csv`, `sitemap`, `systemhealth`, `track-*`, `weekly/weekend-digest-draft` etc.) — um bug de infraestrutura sério, presente desde antes desta auditoria, achado ao tentar deployar a Fase 1 da correção de auth.
**Mitigação aplicada:** workflow dividido em 2 passos — todas as functions exceto `mcp` deployam juntas (sem risco de bloqueio); `mcp` deploya isolada com `continue-on-error: true`, então se falhar só ela fica desatualizada, sem travar as outras 56.
**Passos pra correção definitiva:** avaliar se `defineMcp`/`defineTool` do `@lovable.dev/mcp-js` têm uma forma de importar só o runtime (sem puxar `esbuild`) — ou reescrever `mcp/index.ts` à mão (tomando posse do arquivo removendo o banner "AUTO-GENERATED", conforme o próprio comentário do arquivo permite) implementando os 3 tools (`list_upcoming_events`, `get_event`, `list_blog_posts`) direto com `@supabase/supabase-js`, sem depender do framework de build da lib.
**Responsável:** decisão do usuário sobre qual caminho (esperar fix upstream vs. reescrever à mão), depois IA implementa.

### Várias Edge Functions admin não têm checagem de autenticação no código
**Status:** 🔧 Fases 1-3 de 8 concluídas (15/08/2026) — `send-mass-newsletter`, `import-csv-data`, `upload-csv` (Fase 1), `cleanup-storage` (Fase 2), `auto-article-cron`, `create-recurring-events`, `cleanup-sync-logs`, `verify-sources-weekly` (Fase 3) já exigem admin autenticado (ou cron-secret próprio, pros 4 da Fase 3) em produção — confirmado por contract tests rodando contra a function real já deployada. Fases 4-8 (12 functions restantes) ainda abertas.
**Contexto:** `verify_jwt` é `false` em todas as functions do projeto (auth é responsabilidade de cada function). Funções ainda sem checagem, pensadas como "só admin usa": `diagnose-media`, `batch-convert-webp`, `convert-to-webp`, `import-storage`, `fetch-link-metadata`, `systemhealth`, `generate-blog-post-v2`, `generate-blog-post-from-topic`, `generate-blog-suggestions`, `generate-multi-event-article`, `regenerate-blog-image`, `preview-topic-sources`. O padrão usado nas fases anteriores (`authorizeAdminOrCron()` em `supabase/functions/_shared/index.ts`) é reaproveitável nas próximas.
**Casos à parte** (não é "esqueceram auth", precisam de tratamento diferente):
- `send-podcast-notification` — chamada por formulário público real (`Podcast.tsx`); precisa de rate limiting (como `send-contact-email`/`request-data-deletion` já têm), não admin-auth.
- `compose-event-image` — tem 2 chamadores server-to-server sem sessão de usuário (`scan-event-sources`, `apify-instagram-webhook`); exigir admin JWT quebraria essas automações. Precisa de secret interno compartilhado, não é cópia mecânica do padrão admin.
- `import-storage` (ferramenta de migração one-off, pode já ter cumprido o papel) e `convert-to-webp` (placeholder no-op) — decidir entre proteger ou remover.
**Passos:** Fases 2-8 do plano original (detalhado na conversa de 04/08/2026), uma por vez com aprovação antes de cada uma.
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
