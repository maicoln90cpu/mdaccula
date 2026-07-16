# Automação de captação e publicação de eventos ("Event Watcher") — Roadmap mestre

> Plano mestre de viabilidade e fases. O detalhamento tarefa-a-tarefa de cada fase vive
> em planos próprios na mesma pasta (ver seção "Ordem de construção" abaixo). Este
> arquivo é a fonte de verdade sobre o que já foi decidido e o que falta para Fase
> A/B/C/D. Atualizado por último em 17/07/2026 (rodada 2) — ver "Histórico de revisões" no fim.

## Contexto

Hoje a criação de conteúdo sobre eventos (matérias no blog, posts) é manual. A ideia é
uma automação que roda a cada X horas (ex.: 48h) ou sob comando manual, que: (1) varre
fontes cadastradas (sites de parceiros/organizadores e, opcionalmente, Instagram) atrás
de anúncios de evento, (2) extrai os dados do evento, (3) monta uma peça visual
aplicando o template/logo da marca sobre uma imagem, (4) gera o texto da matéria/legenda
via IA, e (5) publica — com aprovação manual — no site e no Instagram.

**Veredito de viabilidade, resumido**: **alta** para a maior parte do fluxo. A investigação
no código mostrou que o projeto **já tem ~70% da infraestrutura necessária rodando em
produção** para um caso de uso quase idêntico (o gerador automático de artigos de blog).
As partes realmente novas são: (a) o "carimbo" visual (logo+título sobre a foto),
(b) a leitura de Instagram de terceiros via **Apify** (decidido com o usuário — ver abaixo)
e (c) a publicação oficial no Instagram (viável, mas com lead time de aprovação da Meta).

**Sobre monitorar Instagram de terceiros**: não existe API oficial da Meta para isso (a
Graph API só gerencia a própria conta business; a Basic Display API foi descontinuada em
dez/2024). O caminho viável é um serviço de scraping-como-serviço. Pesquisa de mercado
(2026) comparou as opções — **Apify** foi a escolha do usuário para o piloto: sem exigir
login, tem inclusive um ator pronto para exatamente este caso de uso
(`instaprism/instagram-post-monitor`, "New Content Alerts API" — monitora se um perfil
postou algo novo), custo baixo (~US$1,50–2,70/1.000 resultados, começa com US$5 grátis),
comunidade grande e manutenção ativa (essencial porque a Meta muda a estrutura do site a
cada poucas semanas e todo scraper quebra periodicamente). Alternativas descartadas por
ora: ScrapeCreators (mais barato, menos maduro), Bright Data (mais confiável, porém
com piso de preço voltado a volume enterprise). Nota jurídica: em *Meta v. Bright Data*
(jan/2024, EUA) a Justiça considerou defensável raspar dados públicos e deslogados do
Instagram — reduz, mas não elimina, o risco de violação dos Termos de Uso da Meta.
Como o usuário optou por **aprovação manual obrigatória em tudo** na v1, esse é o
principal fator que torna o plano seguro de executar mesmo com fontes de dados
imperfeitas ou um scraper que eventualmente falha/quebra.

## Status atual em uma frase

**Fase A está 100% concluída e em produção**, com uma rodada extra de acertos (modal de
fontes, publicação automática opcional, imagem real em vez de sempre IA). O pipeline roda
de ponta a ponta sem nenhum clique manual entre a descoberta do evento e o rascunho
aparecer em `/admin/blog`: varredura → extração (incl. imagem real, se houver) → geração
do artigo (template dedicado, sem citar a fonte, sem link de concorrente) → rascunho
pronto pra edição/publicação manual (ou publicação automática, se o toggle estiver
ligado). Fase B (Apify/Instagram + composição de logo sobre a imagem) ainda não foi
iniciada — mas a parte de "imagem real" que originalmente estava no escopo da Fase B já
foi entregue como extensão da Fase A (ver item 10 abaixo).

## O que já existe e é reaproveitado (achado pela investigação no código)

| Necessidade | Já existe em | Reaproveitado como |
|---|---|---|
| Raspagem de sites cadastrados | Firecrawl (`scrapeWithFirecrawl`, já era usado por `generate-blog-suggestions`) | `scan-event-sources`, produção |
| Extração estruturada por IA | AI Gateway (Gemini) com tool-call estruturado | `supabase/functions/scan-event-sources/extract.ts`, produção |
| Redação de artigo por IA | `generate-blog-post-v2`, modo "evento" (bloco DADOS OFICIAIS, anti-alucinação) | Reaproveitado com um template dedicado pra artigos raspados (ver abaixo) |
| Upload/otimização de imagem | `EventForm.tsx` → `ImageUploadWithCrop` → `webpConverter.ts` → `bunnyUploader.ts` | Reaproveitável tal e qual quando a Fase B precisar de composição de imagem |
| Geração de imagem por IA (fallback) | `generate-blog-post-v2` chama Gemini `gemini-2.5-flash-image` + `imagescript` (lib Deno) | Já gera a imagem de capa de todo artigo do Event Watcher, em background |
| Re-host de imagem real no Bunny | `rehostImageToBunny` em `scan-event-sources` (novo, 17/07/2026 rodada 2), mesmo pipeline decode/resize/WebP de `generateAndAttachImage` | Reaproveitável tal e qual pra `compose-event-image` (Fase B) receber a imagem já pronta no Bunny antes de aplicar o overlay do logo |
| Cron dinâmico configurável | Padrão dos digests (`update-digest-schedule` + `manage_digest_schedule`) | Job `scan-event-sources-cron` liberado na RPC desde a Fase A, **ainda não ativado** (ver pendências) |
| Publicação no site | `blog_posts` (insert/update) | Rascunho nasce direto em `blog_posts` (`published: false`), sem tela de aprovação própria — revisão acontece em `/admin/blog` como qualquer outro post |

**O que NÃO existe e continua sendo trabalho novo real (Fase B em diante):**
- Composição de imagem (logo + título sobre a foto) — nenhum código de overlay/watermark hoje.
- Qualquer integração com Instagram/Meta (Graph API) — zero hoje, nem para ler nem para postar.

## Fase A — o que foi entregue (concluída)

Ordem cronológica real (não é mais o desenho original — o fluxo mudou de forma
significativa no meio do caminho, ver "Histórico de revisões"):

1. **Pipeline base** (`docs/superpowers/plans/2026-07-14-event-watcher-site-sources.md`,
   11 tasks) — `event_sources`, `scan-event-sources`, extração por IA,
   `event_watch_drafts`, template "Evento Padrão" reaproveitado.
2. **Unificação de Fontes + fluxo de 2 passos**
   (`docs/superpowers/plans/2026-07-15-fontes-unificacao-e-fluxo-2-passos.md`) —
   `news_sources`+`event_sources` unificados numa tabela só; tela `EventWatchReview.tsx`
   ganhou um fluxo "Gerar artigo" (prévia) → "Publicar" em vez de aprovar às cegas.
3. **Remoção da tela de revisão dedicada, unificação em `/admin/blog`** (17/07/2026,
   mudança de arquitetura pedida pelo usuário depois de testar o fluxo de 2 passos na
   prática) — `scan-event-sources` passou a chamar `generate-blog-post-v2` sozinho
   (`EdgeRuntime.waitUntil`, sem bloquear a resposta do scan), o rascunho já nasce em
   `blog_posts` (`published: false`) e a revisão passa a ser feita como qualquer outro
   post do blog (editar, trocar foto, publicar, deletar). `EventWatchReview.tsx` foi
   deletado; o botão "Executar Agora" migrou pra `/admin/fontes`.
4. **Botão "Ver fontes e origem" em cada post de `/admin/blog`** — mostra qual
   função/template de IA gerou o artigo e quais fontes foram usadas (fonte de origem +
   contexto adicional), com URL completa e clicável — não só o nome do site.
5. **Correção de segurança de marca (urgente, 17/07/2026)** — um artigo raspado citou o
   nome e o link de checkout de um concorrente (WeGoOut) como se fosse oferta oficial da
   MDAccula. Corrigido em 3 camadas: (a) `ticket_link` extraído nunca mais é enviado pro
   gerador de artigo; (b) novo template **"Raspagem de Eventos"** (separado de "Evento
   Padrão", que fica exclusivo pros eventos cadastrados manualmente) proíbe
   explicitamente citar a fonte, linkar pra terceiros ou usar o cupom MDACCULA; (c)
   prompt de extração reforçado pra nunca incluir o nome da fonte no campo `description`.
6. **Link exato da fonte (17/07/2026)** — antes só a URL raiz da fonte era mostrada no
   modal de fontes. Agora: (a) a extração de evento identifica a página específica da
   notícia quando existe um link no markdown raspado (`event_watch_drafts.source_page_url`);
   (b) o scraping de contexto genérico (usado por *toda* geração do site, não só Event
   Watcher) também tenta achar um link de artigo real em vez de sempre cair na raiz do
   domínio, com uma heurística que filtra âncoras/assets estáticos.
7. **Fontes ampliadas** — 3 novos sites editoriais cadastrados (Wonderland in Rave, DJ
   News Brasil, Central DJ — todos com matérias/entrevistas reais, não só listagem de
   ingresso); `ai_max_scrape_sources` (contexto extra em toda geração do site) subido de
   3 para 7, dentro da margem folgada do plano grátis do Firecrawl (1.000 créditos/mês, 1
   crédito por página raspada).
8. **Modal "Ver fontes e origem" parou de mentir (17/07/2026, rodada 2)** — causa raiz:
   `generate-blog-post-v2` faz *dois* tipos de scraping bem diferentes que estavam sendo
   gravados no mesmo campo (`ai_generated_posts.source_urls`): (a) a extração factual do
   Event Watcher (`event_watch_drafts.source_page_url`, genuinamente ligada ao artigo) e
   (b) um scraping genérico de "tom/estilo" que já existia antes desta sessão, usado por
   *toda* geração de artigo do site (Event Watcher, "Evento Padrão", "Sugestões
   Aleatórias") só pra dar inspiração de prosa ao prompt — pega fontes aleatórias sem
   nenhuma relação com o tema do artigo específico. Misturar os dois fazia o modal mostrar
   coisas como uma matéria do Rock in Rio como "fonte" de um artigo do Tomorrowland.
   Corrigido: `generate-blog-post-v2` agora sempre grava `source_urls: null` (o texto
   raspado continua enriquecendo o prompt normalmente, só para de ser reportado como
   citação). `generate-blog-post-from-topic` (busca real por tema via Firecrawl
   `/v1/search`) não muda — continua sendo a única função que grava citações genuínas
   nesse campo. Limpeza retroativa: 105 linhas antigas de `ai_generated_posts` (todas
   as que tinham `template_id` preenchido, ou seja, vieram de `generate-blog-post-v2`)
   tiveram `source_urls` zerado; as 16 linhas genuínas de busca por tema
   (`template_id IS NULL`) ficaram intactas. Também corrigido: 7 registros de
   `event_sources` tinham `name` cadastrado como a própria URL (ex: nome="wegoout.com.br"
   em vez de "WeGoOut"), causando nome e link idênticos no modal.
9. **Toggle "Publicar automaticamente" em `/admin/blog` (17/07/2026, rodada 2)** — nova
   chave `site_settings.event_watcher_auto_publish` (`'true'`/`'false'`, desligado por
   padrão). Quando ligado, `scan-event-sources` publica o post direto (`published: true`)
   assim que `generate-blog-post-v2` termina, pulando a revisão manual em `/admin/blog`.
   **Decisão explícita do usuário**: isso é deliberadamente mais arriscado que o
   comportamento padrão (rascunho sempre aguarda revisão) — a única proteção nesse modo
   continua sendo o template "Raspagem de Eventos" (nunca citar fonte, nunca linkar
   concorrente). Rótulo da UI deixa esse risco explícito.
10. **Imagem real do evento em vez de sempre gerar por IA (17/07/2026, rodada 2)** — parte
    do escopo original da Fase B ("composição de imagem") foi adiantada: `extract.ts`
    ganhou um campo `image_url` (a IA de extração identifica um flyer/foto real no
    markdown raspado, nunca ícones/logos genéricos); nova função `rehostImageToBunny` em
    `scan-event-sources` baixa essa imagem e re-hospeda no Bunny (nunca hotlink direto pro
    CDN de terceiros), reaproveitando o mesmo pipeline decode/resize/WebP de
    `generate-blog-post-v2`. Se não achar imagem clara ou o re-host falhar por qualquer
    motivo, cai silenciosamente no fallback de sempre (gerar por IA) — sem regressão
    possível. **O que falta pra Fase B não é mais "imagem real" — é só o overlay do logo
    da MDAccula sobre essa imagem** (`compose-event-image`, ainda não iniciado, aguardando
    o usuário providenciar o arquivo do logo).

### Descoberta operacional: bug do deploy tool com `EdgeRuntime.waitUntil` (17/07/2026)

Durante o deploy do item 9, `scan-event-sources` ficou fora do ar (`503 BOOT_ERROR`) por
~40 minutos. Causa raiz isolada por bissecção extensa (não é bug do código do projeto):
a ferramenta de deploy usada nesta sessão (`mcp__supabase-mdaccula__deploy_edge_function`)
falha ao "bootar" a função sempre que o payload de deploy é **multi-arquivo** (`index.ts`
+ arquivos extras, não importa se `./mesmo-diretório.ts` ou `../_shared/x.ts`) **e** o
código contém uma chamada real a `EdgeRuntime.waitUntil(...)`. Cada peça isolada
(extração, rehost de imagem, geração de rascunho) funciona perfeitamente sozinha em
builds multi-arquivo — só quebra quando o loop principal com `EdgeRuntime.waitUntil` está
presente num deploy que não é um único arquivo. **Fix**: deploy de `scan-event-sources`
agora é sempre um único arquivo com tudo inlinado (dedupe.ts + extract.ts + as funções de
`_shared/index.ts` usadas) — documentado como comentário no topo do próprio
`supabase/functions/scan-event-sources/index.ts`. O repo continua com os arquivos
separados (`dedupe.ts`, `extract.ts`) pra manter os testes unitários; só o payload que vai
pro deploy tool precisa ser montado à mão combinando os arquivos antes de cada deploy
futuro dessa função específica.

### Pendências da Fase A (não bloqueiam uso — são decisões operacionais do usuário)

- **Cron automático**: ainda não ligado. Hoje o scan só roda via botão "Executar
  Varredura Agora" em `/admin/fontes`. Ativar é 1 chamada SQL
  (`manage_digest_schedule('scan-event-sources-cron', ...)`) — só falta o usuário decidir
  a cadência (sugestão original: 48h).
- **`DROP TABLE news_sources`**: a tabela antiga continua existindo no banco (vazia de
  uso — nada mais lê dela desde a unificação), só não foi apagada porque essa é uma ação
  irreversível que fica deliberadamente pra confirmação explícita e separada do usuário.
  Usuário já confirmou o "pode" duas vezes em conversas diferentes; falta só a
  confirmação final no momento exato de rodar a migration `DROP TABLE`.
- **Task #20 (débito técnico, não relacionado à Fase A)**: extrair a lógica de seleção/
  renderização de template de `generate-blog-post-v2` pra um módulo testável com testes
  Deno — pendente desde antes da Fase A, baixa prioridade.

## Fase B — Apify (Instagram) + composição de imagem (parcialmente entregue)

**Escopo (confirmado com o usuário em 15/07/2026)**: as duas peças andam juntas nesta
fase, pra permitir teste prático real do pipeline completo antes de decidir qualquer
coisa sobre publicação automática no Instagram (isso fica pra Fase C).

**Atualização 17/07/2026 (rodada 2)**: a etapa de "imagem real" (extrair do site, se
houver, em vez de sempre gerar por IA) já foi entregue como extensão da Fase A — ver item
10 acima. O que falta da Fase B agora é só: (1) Apify/Instagram e (2) o overlay de
logo/marca sobre a imagem (`compose-event-image`), que se aplica tanto à imagem extraída
de sites quanto à mídia nativa de posts do Instagram.

```
[event_sources, type='instagram']
     ▼
scan-event-sources (estendido) — dispara ator Apify de forma ASSÍNCRONA
  (instaprism/instagram-post-monitor ou similar; não espera terminar dentro do cron,
  evita estourar timeout de Edge Function)
     ▼
apify-instagram-webhook (Edge Function NOVA) — recebe o retorno da Apify quando o
  scraping termina, roda a extração por IA (mesmo padrão de scan-event-sources/extract.ts),
  grava em event_watch_drafts (a imagem já vem pronta — é a própria mídia do post)
     ▼
compose-event-image (Edge Function NOVA, usa imagescript) — logo + barra de marca +
  título sobre a foto (real, extraída de site ou vinda do Instagram; só cai pra imagem
  gerada por IA se nenhuma imagem real existir) → WebP → upload-to-bunny
     ▼
generate-blog-post-v2 (já pronto) — gera o texto da matéria, publishImmediately:false
  (ou publica direto se o toggle de publicação automática, item 9, estiver ligado)
     ▼
Rascunho em /admin/blog, com imagem composta — revisão manual como hoje (ou já publicado,
  se o toggle estiver ligado)
```

### Peças concretas a criar

- **Schema**: nenhuma migração nova necessária — `event_sources.type` já suporta
  `'instagram'` desde a Fase A.
- **Secret novo**: `APIFY_API_TOKEN`.
- **`scan-event-sources` estendido**: branch novo pra `type='instagram'`, dispara o ator
  Apify via API REST, sem aguardar conclusão síncrona.
- **`apify-instagram-webhook`** (Edge Function nova): recebe o callback da Apify,
  reaproveita a lógica de extração já existente, grava em `event_watch_drafts` com
  `source_page_url` = link do post do Instagram.
- **`compose-event-image`** (Edge Function nova): overlay de logo/template sobre a imagem
  real (já resolvida — ver item 10 da Fase A) — trabalho visual novo, sem bloqueio
  técnico (`imagescript` já é dependência do projeto). **Bloqueado**: precisa do arquivo
  do logo da MDAccula em PNG, fundo transparente, alta resolução (usuário vai
  providenciar). Sequenciado como último item da Fase B — o resto (Apify, webhook,
  extração de Instagram) pode ser implementado e testado sem o logo.
- **`/admin/blog`**: modal "Ver fontes e origem" ganha um preview da imagem composta;
  possivelmente uma legenda curta de Instagram (novo prompt, mais curto, com hashtags) —
  a decidir se isso vira um campo novo em `ai_generated_posts` ou fica só no rascunho.

### Riscos já mapeados (do plano original)

- **Direitos autorais de imagem**: mitigado — prioridade pra imagem enviada pelo
  organizador/admin; extração de foto da fonte é alternativa secundária, sempre revisada
  antes de publicar (mesmo gate manual que já existe hoje pro texto).
- **Custo/fragilidade do scraper de Instagram**: tratar falha de uma fonte como skip
  silencioso (mesmo padrão já usado em `scan-event-sources` pros sites), nunca como erro
  fatal do cron inteiro. Monitorar consumo de créditos Apify.
- **Citação de fonte/link de concorrente**: o mesmo problema corrigido nesta sessão pros
  sites (Fase A, item 5) vale igualmente pra Instagram — o template "Raspagem de
  Eventos" e a regra de nunca enviar link extraído já cobrem isso por padrão, mas vale
  reconfirmar com um teste real assim que a Fase B estiver rodando.

### Verificação (quando implementada)

- Disparo manual de `scan-event-sources` contra uma fonte Instagram de teste →
  confirmar criação de linha em `event_watch_drafts` com dados corretos após o webhook
  retornar.
- Confirmar que `compose-event-image` gera a imagem com overlay correto e sobe pro
  Bunny/Storage.
- Confirmar que o rascunho resultante aparece em `/admin/blog` com imagem composta,
  sem citar a fonte, sem link de concorrente (mesmo teste manual de leitura feito na
  Fase A).
- Testes de contrato em `src/__tests__/contracts/` pras Edge Functions novas.

## Fase C e D — a replanejar

Escopo original, só como referência — sujeito a revisão completa quando a Fase B
estiver testada na prática:

- **C** = publicação oficial no Instagram (Content Publishing API). Maior gargalo de
  cronograma do projeto: exige conta Instagram Business + Página do Facebook + App na
  Meta com permissão `instagram_content_publish` + **App Review da Meta** (1-4 semanas,
  precisa de vídeo/demonstração). Não bloqueia as outras fases — pode começar o processo
  de verificação em paralelo, quando o usuário decidir.
- **D** = provedor de scraping redundante (fallback caso a Apify saia do ar/seja
  bloqueada), suporte a vídeo/Reels, fallback de imagem gerada por IA quando não houver
  foto do organizador.

## Histórico de revisões

- **14/07/2026** — plano original aprovado, Fase A (site-only) desenhada como fatia 1.
- **15/07/2026** — escopo da Fase B ampliado (Apify + composição de imagem juntos, em
  vez de composição isolada); Fontes (`news_sources`/`event_sources`) unificadas; fluxo
  de aprovação virou 2 passos (gerar prévia → publicar).
- **16/07/2026** — Fase A declarada concluída; suíte de testes completa validada;
  roadmap copiado do plano de sessão local pro repositório (este arquivo).
- **17/07/2026** — mudança de arquitetura: tela de revisão dedicada removida, geração
  de artigo passou a ser 100% automática (sem clique "Gerar artigo"), revisão unificada
  em `/admin/blog`; correção de segurança de marca (nunca citar fonte/linkar
  concorrente); extração de link exato da notícia; 3 fontes editoriais novas
  cadastradas; `ai_max_scrape_sources` 3→7.
- **17/07/2026 (rodada 2)** — modal "Ver fontes e origem" corrigido na raiz (parou de
  misturar scraping genérico de tom com citação factual; limpeza retroativa de 105
  registros + 7 nomes de fonte incorretos); toggle de publicação automática
  (`event_watcher_auto_publish`) adicionado em `/admin/blog`; extração de imagem real do
  evento (re-hospedada no Bunny) adiantada do escopo da Fase B, com fallback silencioso
  pra geração por IA; descoberto e documentado um bug do deploy tool (`EdgeRuntime.waitUntil`
  + payload multi-arquivo = `BOOT_ERROR`) que causou ~40min de indisponibilidade de
  `scan-event-sources` durante o deploy — resolvido com deploy single-file pra essa função.
