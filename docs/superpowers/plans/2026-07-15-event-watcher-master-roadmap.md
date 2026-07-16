# Automação de captação e publicação de eventos ("Event Watcher") — Roadmap mestre

> Plano mestre de viabilidade e fases. O detalhamento tarefa-a-tarefa de cada fase vive
> em planos próprios na mesma pasta (ver seção "Ordem de construção" abaixo). Este
> arquivo é a fonte de verdade sobre o que já foi decidido para Fase A/B/C/D — antes
> desta cópia, ele só existia como plano de sessão local
> (`C:\Users\<usuário>\.claude\plans\veja-quais-as-chances-dazzling-babbage.md`), fora do
> repositório e não versionado. Copiado para cá em 16/07/2026 para não se perder entre
> sessões.

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

## O que já existe e será reaproveitado (achado pela investigação no código)

| Necessidade | Já existe em | Reaproveitar como |
|---|---|---|
| Raspagem de sites cadastrados | `generate-blog-suggestions` usa **Firecrawl** sobre a tabela `event_sources` (antes `news_sources`, unificada em 15/07/2026) | Mesmo padrão, já em produção via `scan-event-sources` |
| Extração estruturada por IA | `generate-blog-suggestions` já usa tool-call/JSON estruturado no AI Gateway (`ai.gateway.lovable.dev`, Gemini) | Novo prompt em `ai_prompt_templates`, extração de evento — já implementado (Fase A) |
| Redação de artigo por IA | `generate-blog-post-v2` já tem um **modo "evento"** no prompt ("DADOS OFICIAIS", anti-alucinação) | Reaproveitado quase 1:1 na Fase A |
| Upload/otimização de imagem | `EventForm.tsx` → `ImageUploadWithCrop` → `webpConverter.ts` → `bunnyUploader.ts` → `upload-to-bunny` Edge Function (crop, compressão, WebP, dedupe por hash, CDN Bunny + backup Supabase Storage) | Usar tal e qual para imagem enviada pelo organizador/admin |
| Geração de imagem por IA (fallback) | `generate-blog-post-v2`/`regenerate-blog-image` já chamam Gemini `gemini-2.5-flash-image` e processam com **`imagescript`** (lib Deno) | Fallback quando não houver foto; `imagescript` também serve para desenhar o overlay |
| Cron dinâmico configurável pelo admin + botão manual | Padrão dos digests: `update-digest-schedule` + RPC `manage_digest_schedule` (unschedule/schedule + `net.http_post` com secret); `RecurringEventsManager.tsx` tem botão "Executar agora" | Copiado para `scan-event-sources-cron` (job liberado na migration, ainda não ativado — ver Fase A) |
| Tela de revisão/aprovação | `BlogManager.tsx` (lista + toggle publicado/rascunho) | Modelo de UI usado em `EventWatchReview.tsx` |
| Publicação no site | `EventForm.tsx` (insert em `events`) e `generate-blog-post-v2` (insert em `blog_posts`) | Fase A usa só o insert em `blog_posts` (rascunho → publicado), sem criar linha em `events` — ver nota de escopo no plano detalhado da Fase A |

**O que NÃO existe e é trabalho novo real:**
- Composição de imagem (logo + título sobre a foto) — nenhum código de overlay/watermark hoje.
- Qualquer integração com Instagram/Meta (Graph API) — zero hoje, nem para ler nem para postar.
- Fluxo de rascunho/aprovação com status (`pending_review/approved/rejected/published`) — implementado na Fase A, incluindo o passo intermediário "prévia gerada, aguardando publicação" (dois cliques: "Gerar artigo" → "Publicar").

## Desenho do fluxo completo (visão de produto final, Fases A+B+C)

```
[event_sources]                         (sites de parceiros via Firecrawl
     │                                    E perfis Instagram via Apify —
     ▼                                    ambos read-only, desde o piloto)
scan-event-sources  (Edge Function, cron a cada N horas OU botão "Executar agora")
     │  ├─ type='site'      → Firecrawl (implementado, Fase A)
     │  └─ type='instagram' → Apify (ator instagram-post-monitor ou instagram-scraper,
     │                         chamado via APIFY_API_TOKEN; disparo assíncrono +
     │                         webhook de retorno, para não travar o cron) — Fase B
     ▼
Extração por IA  (AI Gateway + template em ai_prompt_templates,
                   tool-call estruturado: nome, data, local, lineup, imagem/fonte)
     │  de-dupe contra events/drafts existentes (título+data aproximados)
     ▼
event_watch_drafts  (status: pending_review → approved → published)
     │
     ├─► compose-event-image (Edge Function, imagescript): logo + barra de marca +
     │     título sobre a foto (enviada pelo organizador, extraída da fonte, ou
     │     gerada por IA como fallback) → WebP → upload-to-bunny — Fase B
     │
     └─► geração de texto: matéria (modo evento do generate-blog-post-v2, com
           publishImmediately:false) + legenda curta para Instagram (novo
           prompt, mais curto, com hashtags) — Fase B para a legenda
     │
     ▼
Tela de revisão (admin) — EventWatchReview.tsx (implementada, Fase A)
   mostra: fonte, dados extraídos (editáveis), preview da imagem composta (Fase B),
   texto da matéria (editável, já implementado), legenda do Instagram (Fase B)
   ações: Gerar artigo (prévia) → Publicar / Rejeitar (implementado, Fase A)
     │
     ▼ (Publicar)
   ├─ Site: update em `blog_posts` (published: true) — implementado, Fase A
   └─ Instagram: Content Publishing API oficial (conta própria da agência) —
       requer conta Business + app Meta aprovado — Fase C
```

## Placar de viabilidade por peça

- **Raspagem de sites cadastrados (Firecrawl)** — Alta. Concluído na Fase A.
- **Extração e redação por IA** — Alta. Concluído na Fase A.
- **Publicação no site (blog, fluxo de 2 passos)** — Alta. Concluído na Fase A (16/07/2026).
- **Tela de aprovação manual** — Alta. Concluído na Fase A.
- **Agendamento configurável (cron a cada X horas + disparo manual)** — Alta. Disparo manual concluído; cron automático pronto para ligar (1 chamada SQL), aguardando aprovação do piloto pelo usuário.
- **Composição de imagem (template + título sobre a foto)** — Média. Trabalho novo, mas sem bloqueio técnico: `imagescript` (já é dependência do projeto) suporta desenho/composição; falta só montar a arte-base (logo, gradiente) e uma fonte embutida. **Fase B.**
- **Monitorar Instagram de terceiros (Apify)** — Média-Alta. Tecnicamente resolvido (ator pronto pra "novo post", API REST simples, sem precisar de login/senha de nenhuma conta Instagram). O que traz risco é operacional/legal, não técnico: é pago (baixo custo na escala do piloto — dezenas de perfis a cada 48h), quebra periodicamente quando a Meta muda a estrutura do site (a manutenção fica a cargo da Apify, mas o `scan-event-sources` precisa tratar isso como "fonte falhou, pula" e não como erro fatal do cron), e tecnicamente contraria os Termos de Uso da Meta (mitigado, não eliminado, pelo precedente *Meta v. Bright Data*). **Mitigado pela aprovação manual obrigatória** — um rascunho ruim é só descartado, nunca vai ao ar sozinho. **Fase B.**
- **Publicar automaticamente no Instagram (conta própria)** — Média-Alta tecnicamente (é API oficial, suportada), mas com **prazo real**: exige conta Instagram Business vinculada a uma Página do Facebook, um App na Meta com a permissão `instagram_content_publish`, e passar pelo **App Review da Meta** (normalmente 1 a 4 semanas, precisa de vídeo/demonstração do caso de uso). Esse é o maior gargalo de cronograma do projeto inteiro. **Fase C.**

## Riscos a observar

- **Direitos autorais de imagem**: repostar o flyer/foto de outra página sem permissão é risco jurídico. Mitigado pela escolha do usuário (imagem preferencialmente enviada pelo organizador/admin — foto, arte ou até vídeo — com a extração da fonte como alternativa secundária, sempre revisada antes de publicar).
- **Alucinação de dados** (data/local errados): mitigado reaproveitando a técnica "DADOS OFICIAIS"/anti-alucinação já usada em `generate-blog-post-v2`, e mantendo a revisão manual como gate final.
- **Custo e fragilidade do scraper de Instagram (Apify)**: rodar só na cadência definida (ex. 48h), tratar falha/sem-resultado de uma fonte como skip silencioso (log + segue pras próximas), nunca como erro fatal do cron inteiro. Monitorar consumo de créditos Apify pra não estourar orçamento se o número de perfis cadastrados crescer.
- **Lead time do Instagram (publicação)**: iniciar o processo de verificação de negócio/App Review da Meta o quanto antes, em paralelo ao resto — é o item que mais atrasa, e não bloqueia as outras entregas (a leitura via Apify não depende disso).

## Ordem de construção (revisado em 15-16/07/2026, confirmado com o usuário)

1. **Fase A (piloto — CONCLUÍDA em 16/07/2026)** — site-only: `event_sources`
   (`type='site'`, Firecrawl) + `scan-event-sources` + extração IA + `event_watch_drafts`
   + tela de revisão com fluxo de 2 passos (gerar prévia → publicar) + publicação só no
   blog (sem criar linha em `events`).
   Plano detalhado e progresso: `docs/superpowers/plans/2026-07-14-event-watcher-site-sources.md`
   (11 tasks, execução via subagent-driven-development) +
   `docs/superpowers/plans/2026-07-15-fontes-unificacao-e-fluxo-2-passos.md` (unificação
   de `news_sources`/`event_sources`, `publishImmediately`, fluxo de 2 passos).
   **Pendente antes de considerar 100% fechada**: rodar `npm test` +
   `npm run test:coverage:ratchet` completos (bloqueado nesta sessão por sobrecarga da
   máquina do usuário, não por problema de código); teste manual do rascunho real do
   Parador Maresias pelo usuário; decidir se liga o cron automático (opcional); DROP da
   tabela `news_sources` (cleanup final, feito só depois do usuário confirmar que está
   tudo certo).
2. **Fase B (próxima, escopo ampliado em 15/07/2026)** — Apify (fontes `type='instagram'`:
   scan assíncrono via ator `instaprism/instagram-post-monitor` ou similar + webhook de retorno
   `apify-instagram-webhook`) integrado já **para teste end-to-end**, junto com
   `compose-event-image` (overlay de template/logo/título sobre a foto). Objetivo: validar o
   pipeline completo de leitura de Instagram + composição de imagem, com aprovação manual,
   antes de decidir qualquer coisa sobre publicação automática. As duas peças (Apify +
   composição) andam juntas nesta fase, para permitir teste prático real do fluxo.
   **Ainda não iniciada.**
3. **Fase C e D — a replanejar** depois que A e B estiverem concluídas e testadas na prática.
   Escopo original abaixo é só referência, sujeito a revisão nesse momento:
   - C = publicação oficial no Instagram (Content Publishing API, requer App Review da Meta).
   - D = provedor de scraping redundante (fallback caso a Apify saia do ar/seja bloqueada),
     suporte a vídeo/Reels, fallback de imagem gerada por IA.

## Peças concretas a criar na Fase B (quando for para implementação)

- Colunas/tabelas: `event_sources` já suporta `type='instagram'` desde a Fase A (schema
  pronto, sem migração nova necessária para isso).
- Secret novo: `APIFY_API_TOKEN` (via `Deno.env.get`, mesmo padrão de secrets já usado no projeto).
- Edge Functions novas:
  - Estender `scan-event-sources`: para fontes `type='instagram'`, disparar o ator Apify
    (`instaprism/instagram-post-monitor` ou `apify/instagram-scraper`) de forma
    **assíncrona** (não espera o scraping terminar dentro do cron, evitando estourar
    timeout de Edge Function).
  - `apify-instagram-webhook`: endpoint que a Apify chama quando o scraping termina,
    recebe os posts novos, roda a extração por IA e grava em `event_watch_drafts` (mesmo
    `_shared` de CORS/rate-limit/response usado nas demais funções).
  - `compose-event-image`: overlay de logo/template sobre a foto extraída ou enviada.
- Reaproveitar diretamente: `src/lib/imageUtils.ts`, `src/lib/bunnyUploader.ts`,
  `src/lib/webpConverter.ts`.
- Estender `src/pages/admin/EventWatchReview.tsx`: mostrar preview da imagem composta e
  a legenda de Instagram (editável), no mesmo padrão do texto de matéria já implementado.

## Verificação (Fase B, quando implementada)

- Disparo manual de `scan-event-sources` contra uma fonte Instagram de teste em ambiente
  de dev/staging → confirmar criação de linha em `event_watch_drafts` com dados
  extraídos corretos após o webhook retornar.
- Confirmar que `compose-event-image` gera a imagem com overlay correto e sobe pro
  Bunny/Storage.
- Confirmar que a tela de revisão mostra a imagem composta e a legenda de Instagram, e
  que o fluxo de 2 passos (gerar prévia → publicar) continua funcionando com esses campos
  novos.
- Adicionar testes de contrato em `src/__tests__/contracts/` para as novas Edge Functions
  (convenção do projeto) e, se algum bug for encontrado depois, registrar em
  `docs/TESTING.md` + teste em `src/__tests__/regression/`, conforme `CLAUDE.md`.
