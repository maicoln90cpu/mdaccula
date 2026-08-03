
# Plano — Fechar pendências de segurança

Tudo abaixo foi confirmado consultando o banco agora. Nenhum item quebra o site: são portas abertas que ninguém usa.

## Fase 1 — Tirar tabelas sensíveis do Realtime (risco: muito baixo)

**Hoje:** `newsletter_subscribers` e `podcast_submissions` estão publicadas no canal ao vivo (`supabase_realtime`), junto com 12 tabelas de conteúdo (eventos, blog, links — essas ficam como estão).

**Depois:** apenas as tabelas de conteúdo continuam no canal ao vivo.

**Como:** uma migração com `ALTER PUBLICATION supabase_realtime DROP TABLE ...` para as duas tabelas.

**Ganho:** ninguém consegue mais "escutar" cadastros de e-mail ou inscrições de podcast chegando em tempo real.

**Antes de aplicar:** verifico no código se algum painel admin usa Realtime nessas duas tabelas. Se usar, o painel passa a atualizar ao recarregar/refetch (já é o padrão nas outras telas) e eu ajusto o hook no mesmo passo.

## Fase 2 — Fechar as 3 funções administrativas (risco: baixo)

**Hoje:** `get_db_size`, `cleanup_old_logs` e `cleanup_old_egress` podem ser chamadas por visitante anônimo via API.

**Depois:** só `service_role` (Edge Functions e cron) pode executá-las.

**Como:** `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE ... TO service_role`.

**As outras 11 continuam públicas de propósito** (contadores de view/clique/like, `has_role`/`is_admin` usados pelo login do próprio site) — documento essa decisão em vez de deixar como pendência eterna.

**Verificação antes:** confirmo em `src/` e `supabase/functions/` quem chama essas 3. Se o painel admin chamar `get_db_size` direto do navegador, crio/uso uma Edge Function como intermediária para não quebrar a tela de métricas.

## Fase 3 — Buckets de imagem: bloquear listagem, manter acesso (risco: baixo)

**Hoje:** as 3 políticas de leitura (`event-images`, `link-thumbnails`, `team-images`) liberam o bucket inteiro, o que inclui listar todos os arquivos.

**Depois:** abrir uma imagem por URL continua funcionando igual (é o que o site e o Bunny CDN fazem); pedir a lista completa de arquivos deixa de funcionar para o público.

**Ponto de atenção:** telas de admin que fazem "listar arquivos do bucket" (ex.: limpeza de storage) precisam continuar funcionando via admin/service_role. Confirmo isso antes e mantenho a listagem liberada para admin.

## Fase 4 — Documentação e prevenção

- `PENDENCIAS.MD`: remover os itens resolvidos; manter Leaked Password como **não aplicável (decisão do usuário — sem assinatura Supabase)**.
- `docs/SECURITY-AUDIT.md`: atualizar as tabelas de RLS/funções com o novo estado e registrar quais funções são públicas *por design*.
- Adicionar teste em `src/__tests__/database/` que prova que anônimo não executa as 3 funções administrativas (pula sozinho sem credenciais, como os testes atuais).

## Ordem de execução e validação

Uma fase por vez, com checklist manual entre elas:

1. Fase 1 → conferir `/admin` (newsletter e podcast ainda listam e atualizam).
2. Fase 2 → conferir tela de métricas e o cron de limpeza de logs.
3. Fase 3 → conferir imagens de eventos, links e equipe no site, e o upload no admin.
4. Fase 4 → `npm test` + `npx tsc --noEmit` verdes.

## Detalhes técnicos

- Tudo em migrações SQL versionadas; nenhuma alteração de schema de dados (sem risco de perda).
- Fases 1–3 são reversíveis com um comando inverso (`ADD TABLE`, `GRANT`, recriar policy).
- Nenhuma Edge Function precisa de redeploy, salvo se a Fase 2 exigir intermediária para `get_db_size`.
