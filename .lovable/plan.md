# Fase B.6 — Automação: rascunho automático na E-goi ao publicar evento

## Objetivo
Quando um evento novo for publicado (status `active`) **e** o admin marcar explicitamente "disparar e-mail ao salvar", o sistema deve criar automaticamente uma campanha em **rascunho** na E-goi usando o template padrão configurado no painel. O admin depois revisa e envia manualmente pela E-goi (mesmo comportamento hoje, só que sem precisar montar o e-mail à mão).

## Antes vs Depois

**Antes:**
- Ao criar um evento, o admin precisa entrar na E-goi, copiar arte, escrever assunto, montar HTML manualmente.
- Cada evento novo = ~10 minutos de trabalho manual + risco de erro.

**Depois:**
- Admin cria o evento no MDAccula com toggle "Criar rascunho de e-mail na E-goi" ligado.
- Em segundos, aparece um rascunho pronto na conta E-goi, já com: assunto sugerido do template, HTML renderizado com dados reais do evento (título, flyer, data, local, line-up), lista e remetente escolhidos no painel B.4, link oficial de descadastro.
- Admin só revisa e clica em "Enviar" dentro da E-goi.
- Histórico do disparo fica registrado em `event_email_campaigns` e aparece no painel B.4.

## Camadas de segurança (defesa em profundidade)

1. **Master switch (Lovable):** `site_settings.egoi_email_enabled` precisa estar `true`. Fica OFF por padrão até você validar 1 teste real.
2. **Agência switch:** `egoi_config.is_enabled` precisa estar `true` **e** `list_id`, `sender_id`, `default_event_template_id` preenchidos.
3. **Toggle por evento:** novo campo `events.dispatch_email_on_save` (default `false`). Criar evento **não** dispara e-mail sozinho — só se o admin marcar o toggle no formulário.
4. **Anti-duplicidade atômica:** `events.email_campaign_dispatched_at`. Um `UPDATE ... WHERE email_campaign_dispatched_at IS NULL RETURNING id` garante que dois cliques simultâneos nunca criam dois rascunhos.
5. **Botão "Reenviar" no painel B.4** (já existente na estrutura): limpa `dispatched_at` com confirmação dupla e permite novo rascunho.

## O que muda no código

### Migration
- Adiciona coluna `events.dispatch_email_on_save BOOLEAN DEFAULT false`.
- Adiciona coluna `events.email_campaign_dispatched_at TIMESTAMPTZ NULL` (se ainda não existir).
- Seed de `site_settings`: `egoi_email_enabled = 'false'` (só se ainda não existir).

### Edge function nova: `create-event-email-campaign`
Recebe `event_id`, aplica os 3 guards, faz o UPDATE atômico do `dispatched_at`, renderiza o HTML do template padrão com os dados do evento (usando as funções que já existem em `src/lib/emailTemplates/`), chama a API E-goi para criar a campanha em modo `draft`, grava a linha em `event_email_campaigns` com `status='draft'` (ou `failed` + `error_message` em erro).
Idempotência: se já existe campanha `sent` para o evento → cria uma nova (histórico); se existe `draft/failed/scheduled` → atualiza a existente.

### EventForm
Adiciona um toggle discreto: **"Criar rascunho de e-mail na E-goi ao salvar"** (default OFF). Só aparece se master + agência estiverem ligados e template padrão configurado; caso contrário fica desabilitado com tooltip explicando o motivo.

### Trigger no client (não em SQL)
Após o `insert`/`update` do evento retornar sucesso E `dispatch_email_on_save=true` E status ficar `active`, chama `supabase.functions.invoke('create-event-email-campaign', { body: { event_id } })`. Escolha por client-side em vez de `pg_net`: mais simples de debugar, erros aparecem no toast, e evita dependência de extensão.

### Painel B.4
Adiciona seletor "Template padrão de novos eventos" (grava em `egoi_config.default_event_template_id`) — provavelmente já existe da B.5.1, apenas garantir que está listado como pré-requisito visual do master switch.

## Vantagens
- Zero risco de disparo acidental (3 switches independentes + toggle explícito por evento).
- Histórico completo preservado.
- Sem `pg_net` / SQL trigger — menor superfície de bug, mais fácil de reverter.
- Erros no fluxo E-goi aparecem no toast do admin imediatamente.

## Desvantagens / trade-offs
- Se o admin criar evento via import CSV ou script fora da UI, o rascunho **não** é criado automaticamente (por design — protege contra spam em bulk import). Solução: botão "Criar rascunho agora" no painel B.4 por evento (fica para B.6.1 se você quiser).
- Depende do navegador do admin ficar aberto até a edge function responder (~2s). Se fechar antes, o `dispatched_at` foi marcado mas a campanha pode ter falhado — nesse caso, botão "Reenviar" resolve.

## Checklist manual de validação (após deploy)
1. Painel B.4: master switch continua OFF (esperado). Ligue temporariamente para testar.
2. Confirme que `list_id`, `sender_id` e `default_event_template_id` estão preenchidos.
3. Crie um evento de teste com data futura, marque o toggle "Criar rascunho de e-mail na E-goi".
4. Salve. Deve aparecer toast: "Rascunho criado na E-goi".
5. Entre na sua conta E-goi → deve haver uma campanha nova em rascunho com o HTML renderizado corretamente (título, flyer, data).
6. Volte ao painel B.4 → histórico deve mostrar 1 disparo `draft` para esse evento.
7. Crie outro evento **sem** marcar o toggle → nenhum rascunho deve ser criado.
8. Reative o toggle no primeiro evento e salve → nada deve acontecer (já dispatched). Use "Reenviar" no painel B.4 para forçar novo rascunho.
9. Desligue o master switch e tente de novo → nada acontece, toast informa "Automação de e-mail desativada".

## Pendências (para fases futuras, não agora)
- **B.6.1:** botão "Criar rascunho agora" por evento no painel B.4 (para eventos criados via CSV/script).
- **B.7:** envio imediato (não só rascunho) com dupla confirmação.
- **B.8:** virada de lote (adaptado ao seu fluxo de "avisado 1 dia antes" com upload de arte opcional).
- **B.9:** analytics de aberturas/cliques puxando da E-goi.

## Prevenção de regressão
- Teste unit para a função de idempotência (`sent → cria nova`, `draft → atualiza`, `não existe → cria`).
- Teste de contrato para a edge function: request sem `event_id` → 400; sem auth → 401; master OFF → 200 com `skipped: true`.
- Assertion no EventForm: toggle **nunca** vem `true` por default.
- ESLint continua bloqueando `api.egoiapp.com` fora do shared.
- Documentar no `docs/ROADMAP.md` que o master switch só liga após 1 rascunho validado manualmente.

## Ordem de execução dentro da B.6
1. Migration (colunas novas).
2. Edge function `create-event-email-campaign` + testes.
3. Toggle no EventForm + chamada client-side.
4. Ajuste do painel B.4 (histórico + botão reenviar já estruturados; garantir que funcionam com o novo fluxo).
5. Validação manual com master OFF → ON → teste real → OFF de novo.
