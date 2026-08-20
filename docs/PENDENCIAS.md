# Pendências - MDAccula

> Só itens em aberto que precisam de ação, decisão ou revisão em alguma data futura.
> **Não é changelog** — o que já foi feito vive em [`CHANGELOG.md`](CHANGELOG.md).
> **Não é roadmap** — feature nova planejada (ainda não iniciada por escolha própria) vive em [`ROADMAP.md`](ROADMAP.md).

**Última atualização:** 20/08/2026

---

## Como usar este documento

Cada pendência tem um tipo — isso decide onde ela deveria estar:

| Tipo                    | O que é                                                                                         | Pergunta que responde                     |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 🗳️ **Decisão pendente** | Algo pronto ou quase pronto, mas travado numa escolha que só o usuário pode fazer               | "O que estou esperando alguém decidir?"   |
| 🔧 **Bug conhecido**    | Um problema real já identificado, ainda sem correção aplicada                                   | "O que sei que está quebrado?"            |
| 👀 **Monitoramento**    | Uma mudança já foi feita e entregue — falta só voltar numa data futura pra conferir o resultado | "O que preciso lembrar de checar depois?" |

Quando um item sai de "aberto" (foi decidido, corrigido, ou o monitoramento terminou), ele se torna uma entrada nova no `CHANGELOG.md` e **sai** deste arquivo — não fica registrado como "concluído" aqui.

Se o que você quer registrar é uma feature nova ainda não iniciada (não uma decisão travada, não um bug, não um checkpoint), ela vai pro `docs/ROADMAP.md`, não aqui.

---

## 🔧 Bug conhecido

### Risco residual do R-062: janela estreita onde o cron de limpeza pode liberar um evento que na verdade já teve campanha criada na E-goi

**Contexto:** a correção do R-062 (ver `CHANGELOG.md`) fechou a lacuna principal — uma linha `event_email_campaigns` só fica em `in_progress` (o estado que o cron `heal-stuck-email-dispatches` considera "seguro pra liberar") ANTES de qualquer chamada à E-goi. Mas ainda existe uma janela estreita: se a Edge Function morrer bem NO MEIO da chamada à E-goi (depois de enviar a requisição, antes de receber/processar a resposta), não há como saber se a E-goi recebeu e processou o pedido ou não. Nesse caso raro, o cron de limpeza liberaria a reserva achando que nada foi criado, quando pode ter sido — permitindo, em tese, uma recriação/duplicação.
**Por que não foi resolvido agora:** resolver isso por completo exigiria a E-goi suportar uma chave de idempotência no payload de criação de campanha (pra a mesma requisição, reenviada, nunca criar 2 campanhas) — a API v3 da E-goi não parece expor esse recurso hoje.
**Mitigação existente:** a janela é muito menor que antes (só durante a chamada de rede em si, não o processo inteiro entre claim e confirmação) e o timeout de 25s em `egoiRequest`/`sendEgoiCampaign` limita seu tamanho máximo. Um evento que passa por essa janela específica muito raramente teria, na pior hipótese, uma campanha duplicada criada na E-goi (nunca um envio duplicado silencioso sem rastro — o histórico sempre registra as duas tentativas).
**Passos (se algum dia quiser fechar de vez):** avaliar com a E-goi se existe algum campo de idempotência não documentado, ou aceitar o risco residual (avaliação atual: baixo, dado o tamanho da janela).
**Responsável:** decisão do usuário sobre prioridade — não é uma falha ativa, é um risco residual conhecido e documentado.

---

## 👀 Monitoramento

### Checkpoint: confirmar que o pipeline de prerender completa o ciclo inteiro (gerar + commitar) sem erro depois da correção do rebase

**Checar até:** o próximo disparo (agendado, 09:00 UTC, ou manual) depois que os commits desta sessão (fix do rebase + versão incremental) estiverem em `main`.
**Contexto:** disparado manualmente em 20/08/2026 pela primeira vez com sucesso real — a etapa de gerar HTML funcionou (47min, dezenas de páginas geradas contra `mdaccula.lovable.app`), afastando de vez a suspeita de bloqueio do Cloudflare (não era isso). A etapa seguinte, de commitar o resultado de volta pro repo, falhou com `cannot rebase: You have unstaged changes` — causa raiz: o passo "Build project" roda hooks (`prebuild`) que regeneram `sitemap.xml`/`rss.xml` como efeito colateral, sujando a árvore de trabalho antes do `git rebase origin/main`. Corrigido com um `git checkout -- .` antes do commit. Nesta mesma sessão, o pipeline também ganhou execução incremental (só reprocessa evento/post que mudou desde a última vez, detecta mudança de código relevante automaticamente, e limpa página órfã) — ver `CHANGELOG.md`.
**Passos:**

1. Depois do próximo disparo, conferir se o job completo (gerar + commitar) fica verde e se aparece um commit novo `chore(prerender): atualiza HTML pré-renderizado` em `main`.
2. Se passar: encerrar este checkpoint, vira entrada no `CHANGELOG.md`.
3. Se falhar de novo: abrir o log do step que falhou — o comportamento observado até agora não tem mais relação com Cloudflare, então investigar a partir do erro real reportado.
   **Responsável:** IA confirma no próximo disparo desta mesma sessão (ou o usuário confere a aba Actions depois).

### Checkpoint: checagem de Storage no egress-alert-cron aguardando a API pública do Supabase estabilizar

**Checar até:** revisar em ~30/08/2026 (2 semanas) — se continuar falhando 100% das vezes até lá, reportar pro suporte do Supabase ou aceitar como bônus perdido permanentemente (a correção principal, R-061, já está no ar e não depende disso).
**Contexto:** decisão tomada em 12/08/2026 (R-061) — implementadas as opções 2 e 3 pra fechar o ponto cego do monitor de egress pra Supabase Storage/CDN. A credencial e o código estão corretos e testados (retry com detecção explícita do campo `error`), mas a chamada `https://api.supabase.com/v1/projects/{ref}/analytics/endpoints/logs.all` segue devolvendo `200 OK` com `{"result":null,"error":"Backend error!..."}` 100% das vezes (2 rodadas completas, 6 tentativas, ~4min) — a mesma consulta SQL funciona normal via MCP (`query_logs`), sugerindo que o caminho da API pública de Management é menos confiável que o caminho interno do MCP, não azar pontual.
**Estado atual:** a checagem de Storage continua degradando graciosamente (não quebra o alarme — `ok: true` sempre, ver R-049), só não traz o dado extra ainda. O cron roda 2x/dia (09h e 12h UTC) — cada execução é uma tentativa independente, então pode "pegar" a API pública estável em algum momento.
**Passos:**

1. Conferir em `egress_alerts.details` (ou logs de `function_logs`) se alguma execução do cron trouxe `storage_requests_24h` != `null`.
2. Se sim, encerrar este checkpoint (vira entrada no `CHANGELOG.md`). Se não, na data de revisão acima, decidir entre reportar ao suporte ou aceitar como perdido.
   **Responsável:** IA monitora quando solicitado; não é bloqueante pra mais nada.

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
**Atualização (16/08/2026):** as gerações `auto_cron` mais recentes em `ai_generated_posts` (10/08 a 14/08/2026, 5 no total) apontam todas para URLs de matéria específica (djnews, playbpm, alataj×2, housemag) — nenhum dos 3 padrões problemáticos (listagem/plataforma/página institucional) se repetiu desde os hotfixes. Ainda falta a checagem visual em `/admin/blog` (item qualitativo que só o usuário consegue confirmar com segurança) — se o próximo ciclo também vier limpo, dá pra encerrar este checkpoint.
**Atualização (20/08/2026):** conferidas as gerações `auto_cron` de 16/08 (alataj, artigo sobre hipersexualização no meio artístico) e 18/08 (djmagla, matéria sobre selo Aeden Recordings da Anyma) — ambas apontam pra matéria específica legítima, mesmo padrão limpo. A geração de 14/08 (`djmagla.com/top-100`) foi checada com mais cuidado por levantar suspeita (URL parecia listagem/ranking) — o conteúdo publicado confirma que é o ranking real e completo do DJ Mag LA (100 posições, nomes, texto de abertura/fechamento), não uma página vazia de navegação — **não é recorrência do bug antigo**, segue como ciclo limpo. Total: 7 gerações `auto_cron` seguidas sem repetir os 3 padrões problemáticos (listagem/plataforma/página institucional). Falta só a checagem visual em `/admin/blog` pelo usuário pra poder encerrar.
**Passos:**

1. Depois de cada geração automática (forçada ou pelo cron), abrir `/admin/blog` e conferir se o artigo gerado corresponde de fato a uma matéria real existente na fonte (a URL em `ai_generated_posts.source_urls` bate com uma matéria específica, não homepage/listagem/institucional).
2. Se aparecer outro `skipped-source-article-unusable` ou `skipped-no-new-articles` nos logs (`application_logs`, filtro `Auto-geração`) sem nenhum artigo saindo, reportar a URL/fonte específica pra eu ajustar o filtro — mesmo padrão dos 3 hotfixes anteriores.
3. Depois de 3-5 ciclos limpos (artigo real gerado, ou skip legítimo sem URL estranha), este checkpoint pode ser encerrado.
   **Responsável:** usuário reporta o que encontrar; IA ajusta

### Checkpoint: `event_sources.content_source` do WeGoOut voltou pra `true` sozinho — causa raiz não confirmada

**Checar em:** próximas 2 semanas — conferir semanalmente se algum artigo saiu de Sympla/Ingresse/WeGoOut de novo
**Contexto:** em 09/08/2026, corrigi `content_source=false` pras 3 plataformas de ticketing (Sympla, Ingresse, WeGoOut) às 00:22 UTC (confirmado por SELECT logo em seguida). Por volta de 00:34 UTC — 12 minutos depois, sem eu ter rodado nenhum UPDATE nesse intervalo — o `WeGoOut` (só ele, Sympla/Ingresse continuaram corretos) tinha voltado pra `content_source=true`, e o `auto-article-cron` gerou um rascunho reescrevendo uma página de evento do WeGoOut como se fosse notícia (mesmo padrão do bug original). Busquei em todo o código por qualquer INSERT/UPDATE que grave `content_source` — só achei `FontesManager.tsx` (client-side, exige ação manual de um admin no `/admin/fontes`) e as duas queries de leitura (`auto-article-cron`, `generate-blog-suggestions`). Nenhum cron/webhook/trigger no banco escreve nessa coluna. Corrigido de novo às 01:29 UTC (confirmado). Não consegui confirmar a causa raiz — pode ter sido uma edição real no `/admin/fontes` (o toggle novo da coluna "Conteúdo" foi ao ar nesse mesmo commit) enquanto eu testava, ou algo que não encontrei.
**Atualização (16/08/2026):** conferido direto no banco — as 3 (`Sympla`, `Ingresse`, `WeGoOut`) seguem `content_source=false`, `updated_at` ainda em `2026-08-10 01:29:52 UTC` (a correção de 10/08, sem nenhuma reversão desde então). Já se passou mais de 1 semana das 2 previstas sem repetir o comportamento — se continuar estável até ~23/08/2026, este checkpoint pode ser encerrado.
**Atualização (20/08/2026):** conferido de novo — as 3 continuam `content_source=false`, `updated_at` ainda `2026-08-10 01:29:52 UTC`, sem nenhuma reversão em 10 dias corridos. Faltam ~4 dias pra completar as 2 semanas previstas (23-24/08).
**Passos:**

1. Rodar `select name, type, content_source, updated_at from event_sources where name in ('Sympla','Ingresse','WeGoOut') and type='site';` — as 3 devem estar `false`. Se alguma voltar `true` sem explicação (ninguém mexeu no toggle em `/admin/fontes`), é sinal de um bug real ainda não encontrado — me avisar.
2. Se acontecer de novo, checar `updated_at` de cada linha pra ver se bate com uma sessão de edição manual conhecida.
   **Responsável:** usuário confere periodicamente; IA investiga mais fundo se voltar a acontecer

### Checkpoint: confirmar redução de banda do Bunny CDN e decidir sobre Cloudflare

**Checar até:** sem prazo novo definido — a contagem de 15 dias nem começou de verdade, porque o passo 1 (clicar no botão) ainda não foi feito. Só faz sentido marcar uma data quando isso acontecer; até lá, este checkpoint fica parado esperando a ação do usuário, não o tempo passar.
**Contexto:** Rollout de variantes de imagem (thumb/medium) concluído em 18/07/2026 — ver entrada no [`CHANGELOG.md`](CHANGELOG.md). Falta confirmar com tráfego real se a banda caiu como esperado.
**Passos:**

1. Rodar o botão **"Gerar Variantes para Eventos Ativos"** em `/admin/settings` → aba Mídia (ferramenta pronta, ainda não foi clicado).
2. Depois de ~15 dias de tráfego real, comparar em `/admin` → Métricas Reais → aba Bunny CDN a média de bytes/requisição contra o baseline anotado (~337KB/req, ~90GB/mês, ~$4-5/mês do item de banda).
3. Só reconsiderar Cloudflare-na-frente-do-Bunny se o custo continuar alto mesmo após a queda esperada — origin traffic do Bunny já é só 1,3% da banda total (cache já é eficiente), então o ganho do Cloudflare tende a ser baixo: ele reduziria _quem fatura_ a banda, não os bytes entregues. Se o total de ~$10/mês não cair proporcionalmente, conferir também a fatura detalhada do Bunny (pode ter taxa mínima/storage não relacionado a banda).
   **Responsável:** usuário revisa as métricas (painel do Bunny); IA confere se solicitado

### Checkpoint: branch de produção com `status: MIGRATIONS_FAILED` — confirmado SEM relação com o bug do disparo manual de e-mail

**Checar em:** quando o usuário quiser investigar o branch em si (não é mais bloqueante pra nada)
**Contexto:** bem no início da investigação do disparo do Sirius (fase do R-053), `list_branches` mostrou o branch padrão/produção do projeto (`project_ref: xfvpuzlspvvsmmunznxw`) com `status: "MIGRATIONS_FAILED"`. Chegou a ser cogitado como relacionado (RLS/grants de `event_email_campaigns` num estado inesperado), mas o R-059 achou e confirmou a causa raiz real do `dispatch_in_progress` (comportamento do PostgREST reaplicando o filtro do claim sobre o valor recém-gravado — nada a ver com RLS, grants ou migrations) — então esse branch fica como um item de infraestrutura independente, sem urgência ligada a este bug.
**Atualização (20/08/2026):** `list_branches` hoje não retorna nenhum branch (lista vazia) — nenhum branch aparece com `MIGRATIONS_FAILED` nem com nenhum outro status. `list_migrations` também não aponta nenhuma migration com falha. Não dá pra confirmar com certeza pelas ferramentas disponíveis se o branch problemático foi removido/mesclado ou se só não aparece mais nessa listagem — mas não há hoje nenhum sinal ativo do problema.
**Passos (se/quando o usuário quiser resolver):**

1. Rodar `list_branches`/`list_migrations` de novo e identificar qual migration específica está travada/falhou.
2. Decidir com o usuário se vale corrigir esse branch (aplicar/reverter a migration travada) por motivos próprios, independente do disparo de e-mail.
   **Responsável:** decisão do usuário sobre prioridade — não é uma falha ativa impactando nada em produção hoje.

### Checkpoint: Apify/Instagram aguardando post real para validar o webhook

**Checar em:** sem data fixa — depende de quando o Alataj (ou outra fonte reativada) postar algo novo
**Contexto:** validação prática em 23/07/2026 confirmou que o disparo do ator Apify funciona ponta a ponta (`instagramTriggered:1`, execuções "Succeeded" no console da Apify), mas o teste caiu em "0 resultados" (sem post novo no momento) — o `apify-instagram-webhook` (callback de quando a Apify _encontra_ algo) ainda não foi exercido com um payload real. Detalhes completos em [`docs/superpowers/plans/2026-07-15-event-watcher-master-roadmap.md`](docs/superpowers/plans/2026-07-15-event-watcher-master-roadmap.md) → seção "Validação prática realizada (23/07/2026)".
**Passos:**

1. Deixar a fonte Alataj (ou reativar mais fontes) ativa até um post novo disparar o webhook de verdade.
2. Conferir em `application_logs` e `event_watch_drafts` se o rascunho foi gerado corretamente a partir de dado real.
   **Responsável:** IA confere quando solicitado

---

## 📚 Documentos Relacionados

| Documento          | Descrição                                     | Link                                     |
| ------------------ | --------------------------------------------- | ---------------------------------------- |
| CHANGELOG.md       | Histórico do que já foi entregue              | [CHANGELOG.md](CHANGELOG.md)             |
| ROADMAP.md         | Features novas planejadas, fases e cronograma | [ROADMAP.md](ROADMAP.md)                 |
| README.md          | Documentação técnica                          | [../README.md](../README.md)             |
| PRD.md             | Requisitos do produto                         | [PRD.md](PRD.md)                         |
| CODE_STYLE.md      | Guia de código                                | [CODE_STYLE.md](CODE_STYLE.md)           |
| SECURITY-AUDIT.md  | Auditoria segurança                           | [SECURITY-AUDIT.md](SECURITY-AUDIT.md)   |
| DATABASE_SCHEMA.md | Índice das tabelas por domínio                | [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) |
| EDGE_FUNCTIONS.md  | Índice das Edge Functions                     | [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md)   |
| tabelas.md         | Documentação SQL do banco                     | [tabelas.md](tabelas.md)                 |
