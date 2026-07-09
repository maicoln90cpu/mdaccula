# Integração E-goi — Plano Mestre (aprovado)

Objetivo: disparar e-mail via E-goi para a base quando um evento novo é publicado no MDAccula. Direto MDAccula ↔ E-goi. Default = rascunho (admin revisa e envia manual). Kill switch em 2 níveis.

---

## Decisões consolidadas (aprovadas pelo usuário)

### Refinamentos aceitos
1. **Curl antes da migration** — validar `GET /lists` da E-goi (variações de header: `Apikey` / `ApiKey` / `apikey`) antes de desenhar `_shared/egoi-campaigns.ts` e a tabela `egoi_config`.
2. **Kill switch em 2 níveis visíveis no painel B.4:**
   - **Master (Lovable):** `site_settings.egoi_email_enabled` — read-only na UI, controlado pela agência.
   - **Agência (usuário):** `egoi_config.is_enabled` — editável no painel.
   - UI mostra os dois status separadamente com rótulos "Ativado pela agência" e "Master (Lovable)".
3. **Idempotência SEM `UNIQUE(event_id)`** — preserva histórico:
   - Existe campanha com `status='sent'` → **cria nova** (histórico preservado).
   - Existe campanha com `status IN ('draft','failed','scheduled')` → **atualiza a existente**.
   - Não existe → cria.
   - Índice: `(event_id, created_at DESC)`.

### Schema real do projeto (descoberto)
- `events.status` tem valores `'active'` / `'merged_inactive'` (default `'active'`). **NÃO existe `is_published`/`published_at`.**
- **NÃO existe `feature_flags`** — usar `site_settings` para o master switch.

### Proteção contra disparo acidental (defesa em profundidade)
Como evento nasce `active` direto, aplicar as DUAS camadas:
1. **Coluna `events.email_campaign_dispatched_at TIMESTAMPTZ NULL`** — trigger só dispara se `NULL`. UPDATE atômico previne race condition.
2. **Toggle no EventForm: `dispatch_email_on_save` (default OFF)** — só marca `dispatched_at` quando o admin liga explicitamente. Criar evento ≠ disparar e-mail.
3. **Botão "Reenviar para este evento" no B.4** com confirmação dupla: limpa `dispatched_at` e permite novo disparo.

### Histórico no painel B.4
Agrupado por evento:
```
Evento X — 3 disparos • último: 10/07 14:32 • status: sent
  └─ [expandir] linhas individuais
```

---

## Fases (cada uma = deploy independente, reversível)

### Fase B.1 — Fundação (sem UI pública)
- Secret `EGOI_API_KEY` via `add_secret`.
- Curl smoke test: edge function descartável faz `GET https://api.egoiapp.com/lists` com o header correto; loga formato de resposta.
- Migration:
  - `egoi_config` (singleton: `list_id`, `sender_id`, `mode` = `draft|immediate|scheduled`, `is_enabled`, `scheduled_days_before`).
  - `event_email_campaigns` (`id`, `event_id`, `egoi_campaign_id`, `status` = `draft|scheduled|sent|failed`, `mode`, `error_message`, `sent_at`).
  - `events.email_campaign_dispatched_at TIMESTAMPTZ NULL`.
  - `site_settings` seed: `egoi_email_enabled='false'` (master OFF).
  - RLS: admin-only para as duas novas tabelas.
  - GRANTs corretos para `authenticated` e `service_role`.
  - Índice `(event_id, created_at DESC)` em `event_email_campaigns`.
- `supabase/functions/_shared/egoi-campaigns.ts` (client base, header validado no curl).
- Testes:
  - `smoke-egoi-api-reachable.mjs` (rodar manual).
  - Unit test idempotência: 3 cenários (não existe → cria; existe+draft → atualiza; existe+sent → cria nova).
  - ESLint: bloqueia `api.egoiapp.com` fora do shared.
- **Status site público:** inalterado.

### Fase B.2 — Template do e-mail
- `design--create_directions` com 3 opções (paleta neon/glassmorphism do site).
- Usuário escolhe 1 → converter para `supabase/functions/_templates/event-announcement.tsx` (React Email ou HTML puro se React Email não valer o overhead).
- Rota admin `/admin/email-preview` com mock data para preview.
- Snapshot tests.
- ESLint bloqueia `<script>`, `<style>`, `dangerouslySetInnerHTML` no template.

### Fase B.4 — Painel "Gestão de e-mails" (ANTES do trigger, propositalmente)
- Sidebar: novo item **"Gestão de e-mails"** dentro do grupo **"Links & Distribuição"** (confirmado).
- Rota `/admin/email-config`. 4 seções:
  1. **Status:** badges de "Master (Lovable): ON/OFF" (read-only) + "Agência: ON/OFF" (toggle). Contador 30 dias.
  2. **Configuração:** dropdowns `list_id` e `sender_id` (populados via E-goi API). Modo (`draft`/`immediate`/`scheduled`). Se `scheduled` → input dias. Toggle "Envio automático" fica **desabilitado** até list+sender preenchidos.
  3. **Teste:** botão "Criar rascunho de teste" (evento fake, não afeta trigger real).
  4. **Histórico agrupado:** por evento, com drill-down para disparos individuais. Botão "Reenviar" por evento (limpa `dispatched_at`, confirmação dupla).
- E2E Playwright: acesso admin, toggle, botão de teste.

### Fase B.3 — Auto-trigger (só depois que B.4 estiver testado)
- Edge function `create-event-email-campaign`:
  - Guard 1: `site_settings.egoi_email_enabled = true`?
  - Guard 2: `egoi_config.is_enabled = true` E `list_id`/`sender_id` preenchidos?
  - Guard 3: `events.email_campaign_dispatched_at IS NULL`?
  - UPDATE atômico: `SET email_campaign_dispatched_at=now() WHERE id=? AND email_campaign_dispatched_at IS NULL RETURNING *` — se não retornou linha, aborta (race).
  - Aplica lógica de idempotência (sent → nova; draft/failed/scheduled → atualiza).
  - Modos: `draft` (E-goi status=draft), `immediate` (envia agora), `scheduled` (agenda).
  - Erro → grava `status='failed'` + `error_message`, NÃO limpa `dispatched_at` (evita loop).
- Trigger SQL em `events`:
  - `AFTER INSERT` quando `status='active'` E `dispatch_email_on_save=true` (coluna vem do form).
  - `AFTER UPDATE` quando `status` mudou para `'active'` E `dispatch_email_on_save=true`.
  - Trigger chama a edge via `pg_net` OU seta uma coluna que um cron pega — decidir na hora com base no que já existe no projeto.
- Master switch permanece OFF até usuário validar 1 rascunho de teste no painel B.4.

### Fase B.5 — Editor visual de templates (última, mais complexa)
- Tabela `mdaccula_email_templates`.
- Rota `/admin/email-templates` com editor por blocos (texto/imagem/botão/cor).
- Preview ao vivo, DOMPurify no HTML final.
- Fica documentada aqui, mas só entra depois que B.1–B.4 estiverem estáveis.

---

## Roadmap pós-integração (fora deste PR)
Documentar em `docs/ROADMAP.md`:
- **Fase 2:** aprovação 1-clique via WhatsApp/e-mail.
- **Fase 3:** liberar envio automático sem aprovação após 20+ campanhas OK.
- **Fase 4:** segmentação por categoria de evento.
- **Fase 5:** métricas open/click da E-goi de volta no painel.

---

## Protocolo por fase (obrigatório, memória do usuário)
Ao entregar cada fase, informar:
1. Antes vs depois
2. Melhorias
3. Vantagens/desvantagens
4. Checklist manual de validação
5. Pendências
6. Prevenção de regressão

## Ordem de execução aprovada
B.1 → B.2 → **B.4** (painel antes do trigger) → B.3 (trigger com master OFF, liga só após 1 teste OK no painel) → B.5.

## Próximo passo imediato
1. Pedir `EGOI_API_KEY` via `add_secret`.
2. Criar edge function descartável de curl e rodar contra `GET /lists`.
3. Confirmar header/schema.
4. Só então iniciar migration da Fase B.1.
