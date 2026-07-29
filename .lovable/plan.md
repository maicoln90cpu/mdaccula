## O que eu encontrei (auditoria, sem alterar nada ainda)

### 1) Coordenadas dos eventos
Consultei o banco: **30 eventos ativos e futuros; 4 estão sem latitude/longitude**:
- D.EDGE apres. Moving — 30/07
- D.EDGE apres. FreakChic — 31/07
- D.EDGE apres. Nave — 01/08
- D.EDGE apres. SuperAfter — 02/08

Todos são do mesmo local (D.EDGE, Barra Funda), e outros eventos do mesmo endereço **já têm** coordenadas. Ou seja: não é problema de endereço, é que a geocodificação parou de rodar (ver item 2). Os 4 são exatamente os criados depois da troca de workspace.

### 2) Google Maps depois da troca de workspace — 2 problemas reais
- **A conexão Google Maps existe no workspace, mas NÃO está vinculada a este projeto.** Isso significa que a chave `GOOGLE_MAPS_API_KEY` que as funções usam é a antiga (órfã) — igual ao que aconteceu com a `LOVABLE_API_KEY`. É por isso que os 4 eventos novos não geocodificaram.
- **A função `render-static-map` (imagem do mapa no e-mail) está exigindo login no servidor.** Testei o endereço público e ele respondeu "401 não autorizado". O arquivo de configuração diz que ela deve ser pública, mas o que está publicado no servidor não bate. Resultado prático: **a imagem do mapa não carrega no e-mail** (cliente de e-mail nunca envia login).
- Já funciona OK: `public-maps-config` responde normalmente e devolve a chave do navegador (mapa do site tende a funcionar; confirmo visualmente depois do conserto).

### 3) Problemas de segurança — em linguagem simples

**Os 4 "Críticos" (mesma causa)** — tabelas `blog_view_events`, `event_view_events`, `link_click_events`, `redirect_click_events`:
Existe uma regra chamada "Service role can manage ..." que **deveria** valer só para o servidor, mas foi criada valendo para **todo mundo** (inclusive visitante anônimo). Na prática: qualquer pessoa poderia ler, alterar ou **apagar todas as estatísticas** de visualizações e cliques. Confirmei isso direto no banco.
Correção sem quebrar nada: trocar essas regras para valerem apenas para o servidor. Os registros de clique/visualização continuam funcionando, porque eles passam pelas Edge Functions (`track-view`, `track-link-click`, `track-redirect-click`), que usam a chave de servidor. Também existe regra separada de "qualquer um pode inserir", que será mantida.
Observação: `redirect_click_events` hoje **não tem** regra de inserção pública — depende inteiramente da regra permissiva. Então nesse caso preciso criar a regra de inserção antes de restringir, senão o rastreio de redirects para de gravar.

**Avisos:**
- *Servidor MCP público sem autenticação* — foi escolha sua ("público, sem login"). Os dados expostos já são públicos no site. Pode ficar como está (eu marco como "aceito conscientemente") ou ativamos OAuth.
- *Qualquer usuário logado lê as regras de bloqueio de e-mail* — hoje só admins usam essa tela; a leitura pode ser restrita a admin sem impacto.
- *Configurações do site são públicas* — a página pública precisa de várias dessas chaves (fuso, tema, etc). Mexer aqui tem risco de quebrar o site; recomendo **não mexer agora** e tratar em etapa separada.
- *Funções SECURITY DEFINER executáveis / RLS sempre verdadeiro / Bucket público lista arquivos* — são avisos genéricos do robô da Supabase. A maioria é intencional (ex.: buckets de imagens são públicos de propósito). Reviso um a um e ignoro os que forem falso-positivo, com justificativa registrada.
- *Proteção contra senha vazada desligada* — é um botão nas configurações de autenticação; você liga e ninguém é afetado (só bloqueia senhas já vazadas na internet em novos cadastros).

### 4) Dependências com vulnerabilidade — em linguagem simples

| Pacote | Onde é usado | Risco real aqui | Como corrigir |
|---|---|---|---|
| `vitest` 4.0.16 (Crítico) | Só para rodar testes na sua máquina | Falha só existe se você abrir a "UI de testes"; **não vai para o site publicado** | Atualizar para a versão mais recente do 4.x |
| `@tiptap/*` 3.10.7 | Editor de texto do blog | Médio — falhas de conteúdo colado | Atualizar linha 3.x |
| `react-router-dom` 6.30.1 | Navegação do site | Baixo/médio | Atualizar dentro do 6.x (não migrar para 7 agora) |
| `dompurify` 3.3.1 | Limpeza de HTML | Médio | Atualizar patch |
| `recharts` 2.15.4 | Gráficos do admin | Baixo | Atualizar dentro do 2.x |
| `@supabase/supabase-js` 2.97.0 | Conexão com o banco | Baixo | Atualizar patch |

Regra que vou seguir: **só atualizações compatíveis** (sem mudar versão principal), uma leva por vez, rodando testes e build entre elas.

---

## Plano de execução (fases, uma de cada vez)

**Fase 1 — Reconectar o Google Maps e recuperar os mapas** (risco baixo)
1. Vincular a conexão Google Maps a este projeto (card de conexão aparece no chat).
2. Republicar `geocode-event`, `render-static-map` e `public-maps-config` garantindo que continuem públicas.
3. Rodar a geocodificação dos 4 eventos sem coordenadas e conferir no banco.
4. Testar a imagem do mapa sem login e o mapa na página do evento.

**Fase 2 — Corrigir as 4 falhas críticas de segurança** (risco baixo, com um cuidado)
- Migração que: cria regra de inserção pública faltante em `redirect_click_events`, depois troca as 4 regras permissivas para valerem só ao servidor.
- Validação: registrar um clique de link, um clique de redirect e uma visualização, e confirmar que gravaram.

**Fase 3 — Avisos de segurança** (risco baixo)
- Restringir leitura de `email_global_blocks` a admin.
- Revisar os avisos genéricos e marcar os falso-positivos com justificativa.
- Te oriento a ligar a "proteção de senha vazada" (é um clique na configuração).
- `site_settings` fica documentado como pendência consciente.

**Fase 4 — Dependências** (risco médio, dividida em 2 levas)
- Leva A (não afeta o site): `vitest` + `@vitest/coverage-v8`.
- Leva B (afeta o site): `dompurify`, `@supabase/supabase-js`, `recharts`, `react-router-dom`, `@tiptap/*` — com testes, typecheck e conferência visual do blog/admin.

## Detalhes técnicos
- Confirmado por consulta: `pg_policies` mostra as 4 políticas "Service role can manage ..." com `roles = {public}`, `USING(true)`, `WITH CHECK(true)`, `cmd = ALL`.
- `redirect_click_events` não possui política de INSERT anônima (as outras 3 possuem "Anyone can insert ...").
- `render-static-map` tem `verify_jwt = false` em `supabase/config.toml`, mas a versão publicada responde 401 → precisa redeploy via CLI.
- `standard_connectors--list_connections` mostra `google_maps` com `is linked to project: no` → secret `GOOGLE_MAPS_API_KEY` do projeto é do workspace antigo.
