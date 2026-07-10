## Correções + Automações (Digest semanal & Agenda FDS)

### Resposta rápida à sua dúvida
Hoje o sistema cria **rascunhos automáticos** na E-goi (você entra lá e envia com 1 clique). Ele **não envia sozinho por e-mail**. Isso é proposital — evita mandar erro pra base inteira. Se quiser envio 100% automático depois, é uma etapa extra (adicionar um toggle "auto-enviar" que troca o modo E-goi de `draft` pra `send`). Por enquanto o plano abaixo entrega: **agendar + gerar rascunho automático** dos dois digests (semanal e FDS), sem envio automático ainda.

---

### Fase 1 — Corrigir erro dos templates novos (bloqueante)

**Antes:** ao salvar os presets "Agenda do FDS — Cartaz" e "Agenda do FDS — Timeline", o banco recusa com `email_templates_type_check` porque a constraint atual só aceita `event_new | ticket_batch | weekly_digest | custom`.

**Depois:** migration expande a constraint para incluir `weekend_agenda` e `weekly_digest_editorial`. Presets passam a salvar.

Nada mais muda. Zero risco pros templates existentes.

---

### Fase 2 — Preview com os 4 presets

**Antes:** dropdown "Fonte dos dados" tem só `Evento` e `Digest semanal real`.

**Depois:** dropdown vira 3 opções:
- Evento individual (mock/real)
- Digest semanal real (próximos 7 dias)
- **Agenda FDS real (próximo fim de semana)** ← novo

O seletor "Template" (abaixo) passa a listar os 4 novos presets junto com os antigos, filtrado pela fonte escolhida:
- Fonte "evento" → templates de tipo `event_new/ticket_batch/custom`
- Fonte "digest" → `Cartaz da semana` + `Editorial`
- Fonte "agenda FDS" → `Cartaz FDS` + `Timeline FDS`

O edge `weekly-digest-draft` passa a aceitar `?template_id=xxx` no dry-run, pra renderizar exatamente o template que você escolheu no preview (hoje ele pega o `is_default`). Idem novo edge FDS.

---

### Fase 3 — Reformular aba "Digest semanal" → "Automações"

**Antes:** aba com 1 card só (toggle cron + gerar agora), layout fixo, sem escolha de template, sem controle de horário.

**Depois:** aba renomeada pra **"Automações"** com 2 cards espelhados:

**Card 1 — Digest semanal**
- Toggle "Ativar geração automática"
- Select "Template padrão" (Cartaz da semana / Editorial)
- Select "Dia da semana" (default: quinta)
- Input "Horário" (default: 18:00 BRT)
- Botão "Salvar agendamento"
- Botão "Gerar rascunho agora"
- Texto "Próxima execução: quinta 18:00 SP"

**Card 2 — Agenda do FDS**
- Mesma estrutura
- Templates: Cartaz FDS / Timeline FDS
- Default: quinta 12:00 (antes do fim de semana)

Ambos gravam em `site_settings` (chaves `weekly_digest_*` e `weekend_agenda_*`) e chamam um edge `update-digest-schedule` que refaz o `pg_cron` (usa fuso fixo -3, sem horário de verão).

---

### Fase 4 — Backend das automações

- Nova edge `weekend-agenda-draft` espelhando a `weekly-digest-draft` (mesma auth, mesmo padrão), mas coleta eventos de **sex/sáb/dom** e usa templates `weekend_agenda`. Suporta `dry_run` e `template_id`.
- Nova edge `update-digest-schedule` (uma só, param `job: 'weekly_digest' | 'weekend_agenda'`) que faz `cron.unschedule` + `cron.schedule` com o horário salvo.
- Migration adiciona chaves em `site_settings`:
  - `weekly_digest_template_id`, `weekly_digest_cron_day`, `weekly_digest_cron_hour`
  - `weekend_agenda_enabled`, `weekend_agenda_template_id`, `weekend_agenda_cron_day`, `weekend_agenda_cron_hour`
- Edge `weekly-digest-draft` passa a respeitar `weekly_digest_template_id` (se setado, usa esse; senão continua com `is_default`).

---

### Ordem de execução (deploys em fases seguras)

1. **Fase 1** — migration da constraint. Deploy isolado. Você testa salvar os 2 presets FDS. **Se falhar, reverte migration em 1 comando.**
2. **Fase 2** — preview com os 4 presets. Deploy isolado, só frontend + parâmetro opcional no edge. **Zero impacto no cron.**
3. **Fase 4 (backend primeiro)** — nova edge FDS + edge de agendamento + migration de settings. Sem UI ainda. Testável via botão manual.
4. **Fase 3** — UI da aba "Automações". Deploy final, tudo já plugado.

---

### Riscos & Mitigação

| Risco | Mitigação |
|---|---|
| Migration da constraint quebrar templates antigos | Constraint expande o conjunto, nunca reduz. Templates existentes continuam válidos. |
| Novo cron do FDS conflitar com o semanal | Nomes de job distintos (`weekly-digest-cron`, `weekend-agenda-cron`). Um não sobrescreve o outro. |
| Falha no cron silenciosa | UI mostra "Próxima execução" calculada; edge de agendamento retorna erro claro se `pg_cron` recusar. |
| Preview do FDS sem eventos no fim de semana | Retorna placeholder (mesmo comportamento do digest hoje). |

### Checklist de validação (após deploy completo)

- [ ] Salvar os 2 presets FDS sem erro.
- [ ] Preview mostra os 4 templates novos com dados reais.
- [ ] Toggle + horário do Digest semanal salva e mostra "Próxima execução".
- [ ] Toggle + horário da Agenda FDS salva e mostra "Próxima execução".
- [ ] Botão "Gerar rascunho agora" funciona pros dois.
- [ ] Rascunho aparece na E-goi com o template escolhido.

### Prevenção de regressão

- Testes de contrato do edge `weekly-digest-draft` continuam válidos (o `template_id` é opcional).
- Fallback do edge continua: se template do banco falhar, cai no HTML legado.
- Migration idempotente (`DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`).

### Pendências propositais (fora desta onda)

- **Envio automático** (sem passar pela revisão manual na E-goi) — só se você aprovar depois.
- Preview do "Agenda FDS" via botão dedicado (por ora reaproveita o `dry_run` do edge novo).
- Google Maps no bloco `static_map` (ainda pendente da onda D anterior).

---

**Posso começar pela Fase 1 (migration da constraint) já?** É a mais rápida (1 comando) e destrava seu problema imediato dos presets FDS.