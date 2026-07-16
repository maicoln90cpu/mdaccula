# Unificar tabelas Fontes + fluxo de aprovação em 2 passos (gerar prévia → publicar)

> Status: **CONCLUÍDO em 16/07/2026.** Mantido como histórico de referência — copiado
> do plano de sessão local (`C:\Users\<usuário>\.claude\plans\compressed-scribbling-snowflake.md`)
> para o repositório, para não se perder entre sessões. Faz parte da Fase A do Event
> Watcher — ver `docs/superpowers/plans/2026-07-15-event-watcher-master-roadmap.md`.

## Contexto

Depois de fechar o hub de IA (6→3 rotas) e a revisão dos templates, o usuário testou o
sistema na prática e trouxe 2 problemas reais de uso (dos 5 pontos levantados, itens 1 e
4 — os outros 3 já foram respondidos/corrigidos na conversa):

1. **Fontes duplicadas**: `news_sources` e `event_sources` eram duas tabelas separadas,
   obrigando a cadastrar a mesma URL duas vezes se ela deveria alimentar tanto sugestão
   de pauta/contexto de artigo quanto varredura de evento. O usuário confirmou que na
   prática só preenchia `name`+`url` nas duas — a diferença de schema que existia
   (`description` de um lado, `type`/metadados de varredura do outro) não travava nada no
   uso real dele.
2. **Aprovação sem poder ler antes**: no Event Watcher, "Aprovar e publicar" gerava o
   texto do artigo E já publicava no mesmo clique — não dava pra ler antes de decidir. O
   rascunho do Parador Maresias ficou parado exatamente por isso.

## Parte 1 — Unificar `news_sources` + `event_sources`

### Decisão de design: manter a tabela `event_sources` como base

`event_sources` já tinha o schema mais rico (trigger de `updated_at`, `GRANT`s
explícitos, índice em `enabled`, FK de `event_watch_drafts.source_id` apontando pra
ela) — mais barato manter esse nome e **adicionar** o que faltava (`description`) do que
criar uma tabela nova e migrar as duas. Único efeito colateral: a tabela se chama
`event_sources` mesmo guardando fontes de notícia também — puramente cosmético, não
aparece pra ninguém fora do código (a UI mostra só "Fontes").

**Achado extra da investigação, corrigido de graça na mesma migration**:
`event_sources` nunca tinha sido adicionada à publicação `supabase_realtime` (só
`news_sources` tinha) — `FontesManager.tsx` já assinava realtime pras duas tabelas,
então a metade "Eventos" da tela não atualizava sozinha quando `scan-event-sources`
rodava em background.

### Migration (`supabase/migrations/`)

- Adicionada coluna `description text` em `event_sources`.
- Dados de `news_sources` migrados via `insert ... where not exists (dedupe por url)`.
- `event_sources` adicionada à publicação `supabase_realtime` com `REPLICA IDENTITY FULL`.
- `DROP TABLE news_sources` **deliberadamente excluído** da migration automática — fica
  como passo separado, só depois de confirmação explícita do usuário (ação irreversível,
  bloqueada pelo classificador de segurança quando testada dentro da migration principal).

### Consumidores atualizados

- `supabase/functions/generate-blog-suggestions/index.ts` — trocado
  `.from('news_sources')` → `.from('event_sources')`, mantido
  `.select('name, url, description').eq('enabled', true)` (sem filtro de `type`).
- `supabase/functions/generate-blog-post-v2/index.ts` — mesma troca, mantido
  `.select('name, url').eq('enabled', true).limit(maxScrapeSources)`.
- `supabase/functions/scan-event-sources/index.ts` — nenhuma mudança: já lia
  `event_sources` filtrando `type='site'`.

### `src/types/index.ts`

Removidos `NewsSource`/`NewsSourceInsert`; `EventSource`/`EventSourceInsert` estendidos
com `description?: string | null`. `src/integrations/supabase/types.ts` regenerado via
`mcp__supabase-mdaccula__generate_typescript_types`.

### `src/pages/admin/FontesManager.tsx` — simplificado de "2 abas" pra "1 lista só"

Antes alternava entre duas queries/tabelas via `activeTab`. Agora é uma tela única: uma
`useQuery` só em `event_sources`, uma tabela só (Nome, URL, Descrição, Tipo, Ativa,
Última varredura, Ações), um formulário só (nome, url, descrição opcional, tipo —
dropdown site/instagram, ativa). Sem alternância de aba.

## Parte 2 — Fluxo de aprovação em 2 passos no Event Watcher

### Desenho (reaproveitando mecanismos já existentes, risco baixo)

- O parâmetro `existingPostId` que `generate-blog-post-v2` já aceitava (usado por
  "Regenerar artigo" no `BlogManager.tsx`) — regenerar a prévia virou um `update` em vez
  de criar posts duplicados.
- O padrão de toggle publicado/rascunho que `BlogManager.tsx` (`togglePublished`) já
  usava — publicar a prévia é o mesmo `update` de um campo.
- O status `'approved'` que já existia em `EventWatchDraftStatus` mas nunca era usado —
  virou o estado "prévia gerada, aguardando publicação".

### `supabase/functions/generate-blog-post-v2/index.ts`

Novo parâmetro opcional `publishImmediately` (default `true` se omitido — nenhum outro
chamador mudou de comportamento: a aba "Gerar", "Sugestões", `EventsManager` etc.
continuam publicando na hora). Só quando `publishImmediately === false`, o insert grava
`published: false`/`published_at: null`. Verificado ao vivo contra a função implantada:
draft mode produz `published:false`; `existingPostId` regenera no mesmo post; omitir o
parâmetro preserva o comportamento antigo para todos os outros chamadores.

### `src/pages/admin/EventWatchReview.tsx`

- Novo estado `generatedArticle: { id, title, excerpt, content } | null`, resetado ao
  abrir/fechar um rascunho (e pré-carregado se o rascunho reaberto já estiver
  `status: 'approved'` com `published_blog_post_id` preenchido).
- `approveMutation` (fazia tudo de um clique) virou `generateMutation`: chama
  `generate-blog-post-v2` com `publishImmediately: false` (passando `existingPostId` se
  já tiver gerado antes, pra regenerar em vez de duplicar), guarda o resultado em
  `generatedArticle`, marca `event_watch_drafts.status = "approved"` +
  `published_blog_post_id` já preenchido.
- Novo bloco na tela: mostra título/excerpt/conteúdo renderizado do `generatedArticle`
  dentro de uma área rolável — só aparece depois que existe.
- Novo `publishMutation`: `update` simples em `blog_posts` (`published: true`,
  `published_at: now()`), e marca `event_watch_drafts.status = "published"`.
- Botões do rodapé: "Rejeitar" (inalterado), "Gerar artigo" (vira "Gerar novamente"
  depois da primeira vez), "Publicar" (só aparece depois que `generatedArticle` existe).
- Lista de rascunhos pendentes ampliada para mostrar também `status: 'approved'` (não só
  `pending_review`), com badge "Aguardando publicação" — evita que um rascunho já gerado
  mas não publicado desapareça da fila se o admin fechar o diálogo antes de publicar.
- Se o usuário rejeitar depois de já ter gerado uma prévia: o post em `blog_posts` fica
  órfão como rascunho não-publicado (gerenciável em Blog Manager) — mais simples e
  seguro do que tentar deletar.

## Verificação

- Parte 1: migration aplicada; `generate_typescript_types`; `npx tsc --noEmit` limpo;
  `npm run lint` limpo nos arquivos tocados; confirmado por SQL que não há URLs
  duplicadas em `event_sources`.
- Parte 2: `npx tsc --noEmit` limpo; comportamento de `publishImmediately` verificado ao
  vivo via chamadas diretas à função implantada (3 cenários: draft, regeneração via
  `existingPostId`, comportamento padrão inalterado).
- **Pendente**: teste manual real pelo usuário — abrir o rascunho do Parador Maresias
  (ainda em `pending_review`), clicar "Gerar artigo", ler o texto na tela, só depois
  clicar "Publicar", confirmar em `/admin/blog` que o post está publicado e em
  `event_watch_drafts` que o status final é `published`. `npm test` completo também
  pendente (bloqueado por sobrecarga da máquina, não por problema de código).
- `DROP TABLE news_sources`: cleanup final, deliberadamente adiado até confirmação
  explícita do usuário de que tudo está funcionando.
