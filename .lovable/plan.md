# Onda B.10 — Teste A/B de assunto (E-goi split test)

## Objetivo
Permitir que o admin, ao disparar uma campanha de evento, envie **duas versões de assunto** (A e B) para uma amostra da lista. A E-goi mede aberturas por N horas e envia automaticamente a versão vencedora ao restante.

## Como está hoje (antes)
- No painel `/admin/email-config` → aba **Histórico**, cada evento tem "Criar rascunho" e "Enviar agora".
- Só existe **um assunto** por campanha.
- Não há como comparar títulos empiricamente — o admin escolhe no escuro.

## Como fica (depois)
- No card de cada evento (Histórico) e na aba **Virada de lote**, novo botão **"Enviar teste A/B"** ao lado de "Enviar agora".
- Ao clicar, abre modal com:
  - Assunto A (obrigatório, pré-preenchido com o assunto atual)
  - Assunto B (obrigatório, campo novo)
  - **% de amostra por versão** (slider 10–40%, default 20%) — cada versão recebe essa fatia
  - **Janela de teste em horas** (slider 2–48h, default 6h)
  - **Métrica vencedora** — aberturas (default) ou cliques
  - Checklist de dupla confirmação (mesma UX do "Enviar agora") + digitar "ENVIAR AB"
- Ao confirmar:
  1. Cria a campanha na E-goi como draft (mesmo fluxo do `dispatchEventDraftEmail`).
  2. Chama endpoint E-goi de split test para configurar A/B com os parâmetros.
  3. Envia imediatamente (a E-goi cuida do delay e da escolha do vencedor).
  4. Grava no histórico (`event_email_campaigns`) marcando `campaign_type = 'ab_subject'` com JSON dos parâmetros.
- Na exibição do Histórico, campanhas A/B mostram badge **"A/B"** e, quando as métricas B.9 chegam, indicam qual versão venceu (via `stats_json.winning_variant`).

## Detalhes técnicos
1. **Migration:**
   - Coluna `campaign_type text default 'standard'` em `event_email_campaigns` (valores: `standard`, `ticket_batch`, `weekly_digest`, `ab_subject`).
   - Coluna `ab_test_config jsonb null` para guardar `{subject_a, subject_b, sample_pct, window_hours, winner_metric}`.
2. **`dispatchEventDraftEmail` (src/lib/emailTemplates/dispatchEventDraft.ts):**
   - Novos overrides opcionais: `abTest?: { subjectB, samplePct, windowHours, winnerMetric }`.
   - Quando presente, após criar o draft na E-goi, chama a edge function nova `egoi-ab-test-schedule` passando o `campaign_hash` + config.
3. **Nova edge function `egoi-ab-test-schedule`:**
   - Auth admin only.
   - Chama `POST /campaigns/email/{hash}/tests` (endpoint oficial split test da E-goi v3) com payload:
     ```
     { subject_a, subject_b, test_size_pct, wait_hours, winning_criteria }
     ```
   - Se a E-goi não expuser endpoint direto de split-test, fallback: cria **duas campanhas separadas** apontando para **dois segmentos aleatórios** de X% cada, com envio agendado; nesse caso o vencedor é decidido pela edge function `egoi-campaign-stats` após a janela (job pontual).
   - Retorna status para o frontend.
4. **UI (`src/pages/admin/EmailConfig.tsx`):**
   - Modal `ABTestDialog` reutilizável (Histórico + Virada de lote).
   - Reaproveita o checklist de dupla confirmação do "Enviar agora".
5. **Histórico:**
   - Badge "A/B" nas campanhas `campaign_type='ab_subject'`.
   - Se `stats_json.winning_variant` existir (populado pela B.9-extra), destaca "Venceu: Assunto A" / "Venceu: Assunto B".

## Riscos
- **E-goi pode não expor split-test em v3 REST.** Se confirmarmos ausência, cai no fallback (2 campanhas + escolha manual/automática após janela). Vou verificar o endpoint na primeira etapa da implementação; se falhar, aviso antes de prosseguir.
- **Custo:** cada teste dispara 2× o número de e-mails para a amostra + 1× para o restante. Sem impacto na lista total.
- **Regressão:** o fluxo padrão "Enviar agora" continua intacto — A/B é caminho paralelo opcional.

## Checklist manual (após implementar)
1. Master switch ON; abrir Histórico de um evento.
2. Clicar "Enviar teste A/B", preencher A e B, 20%/6h/aberturas, confirmar.
3. Verificar toast de sucesso e entrada no histórico com badge A/B.
4. Conferir na E-goi que a campanha foi criada como split test (ou as duas campanhas do fallback).
5. Após 6h, atualizar métricas — o card mostra qual versão venceu.
6. Testar cancelamento do modal (fecha sem enviar).
7. Testar validação: A=B deve bloquear; assunto vazio deve bloquear.

## Vantagens x desvantagens
- **+** Descoberta de assunto vencedor sem chutes; +5-15% de abertura típico com A/B em campanhas maduras.
- **+** Sem alterar fluxo padrão — 100% opt-in.
- **−** Requer amostra mínima (~500 envios/versão) para ter significância; abaixo disso o vencedor é ruído. Vou adicionar aviso no modal quando alcance estimado < 1000.
- **−** Se a E-goi não tiver split-test nativo, o fallback tem lógica mais complexa e pode ter delay de até 15min pós-janela para o disparo do vencedor.

## Prevenção de regressão
- Teste de contrato para `egoi-ab-test-schedule` (401 sem auth, 400 sem config, 200 com admin).
- Teste unitário do `dispatchEventDraftEmail` garantindo que **sem** `abTest` o comportamento permanece idêntico (assinatura de argumentos).

## Pendências (ficam pra depois)
- UI para editar A/B em rascunho antes de enviar (hoje é decisão no momento do envio).
- Histórico específico de "batalhas A/B" agregado (dashboard de aprendizados).

## Ordem de execução
1. Verificar endpoint E-goi de split-test (leitura da doc via `egoi-curl-probe` se necessário).
2. Migration (`campaign_type` + `ab_test_config`).
3. Edge function `egoi-ab-test-schedule`.
4. Ajuste em `dispatchEventDraftEmail`.
5. Modal + botão na UI.
6. Badge no histórico.
7. Testes de contrato.
