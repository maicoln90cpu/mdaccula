# Onda D — Melhorias no Digest Semanal (aprovado)

Decisões confirmadas com o usuário:

1. **Preview do digest real**: alternativa B — dropdown "Fonte dos dados" na aba Preview existente (sem card duplicado).
2. **Bloco Dedge no "Cartaz da semana"**: sim, incluir por padrão, mas como bloco removível pelo editor (igual aos outros blocos — o usuário arrasta pra fora se não quiser).
3. **Cron default**: segunda-feira 10:00 (America/Sao_Paulo), com dia e hora **personalizáveis** pelo admin.

---

## Ordem de execução (fases seguras)

### D.3 — Preview real do digest na aba Preview (primeira etapa, mais barata)
- Editar `supabase/functions/weekly-digest-draft/index.ts` — aceitar `?dry_run=true` (ou body `{ dry_run: true }`); nesse modo pula o `POST /campaigns/email` da E-goi e retorna `{ ok:true, dry_run:true, html, subject, events_count, posts_count, range }`. Retrocompatível: modo normal continua igual.
- Editar aba "Preview" em `src/pages/admin/EmailConfig.tsx`: adicionar select "Fonte dos dados" com 3 opções:
  - `mock` — dados de exemplo (atual).
  - `next_event` — próximo evento real (atual, se disponível).
  - `weekly_digest` — chama a edge function em modo dry-run e injeta o HTML direto no iframe (600px).
- Botão "Atualizar preview" ao lado do select.
- **Ganho imediato:** vê o digest da semana como ele sai, sem esperar a quinta ou criar rascunho de teste na E-goi.

### D.1.b — Novo preset "Digest Semanal — Cartaz da semana" (recomendado)
- Novo bloco `weekly_hero`: destaque full-width do 1º evento da semana (imagem grande + título + data + venue + CTA).
- Reaproveita `weekend_grid` (layout cartaz) para os demais eventos da semana — o helper `getWeeklyEvents()` popula `weekendEvents` com 7 dias em vez de 3.
- Novo bloco `blog_posts_list`: cards horizontais com thumbnail + título + trecho + "Ler matéria →" (consome `blogPosts` do payload).
- Bloco `dedge_block` incluído por padrão no preset — o usuário remove no editor se não quiser.
- Preset registrado como `template_type: "weekly_digest"` (a edge function já reconhece).

### D.1.a — Novo preset "Digest Semanal — Editorial"
- Estilo revista: eyebrow, título grande, subtítulo.
- `weekend_grid` em modo **timeline** alimentado com a semana inteira.
- `blog_posts_list` para matérias em alta.
- CTA "Ver agenda completa" + rodapé.
- (Sem Dedge por padrão neste — foco editorial.)

### D.2 — Agendamento configurável do cron

**UI na aba Digest Semanal (`/admin/email-config`)**
- Toggle "Ativar geração automática do digest semanal" (já existe — `weekly_digest_enabled`).
- **Novo:** Select de dia da semana. Default: **segunda-feira**.
- **Novo:** Input de horário. Default: **10:00** (America/Sao_Paulo).
- Botão "Salvar agendamento" → salva em `site_settings` (`weekly_digest_cron_day`, `weekly_digest_cron_hour`) e chama edge function `update-weekly-digest-schedule`.
- Exibe "Próxima execução: segunda 10:00 SP" calculado a partir do que foi salvo.

**Backend**
- Nova edge function `update-weekly-digest-schedule`: recebe `{ day: 1..7, hour: 0..23 }`, converte SP → UTC (fixo -3, ignora DST porque BR não tem DST), roda `cron.unschedule('weekly-digest-cron')` + `cron.schedule('weekly-digest-cron', 'X X * * X', $$…$$)`. Guard: admin obrigatório.
- **Prevenção de regressão:** retorna `next_run_at` calculado; UI mostra ao usuário para confirmação visual.

---

## Riscos & Mitigação

- **`pg_cron` falhar silenciosamente:** UI mostra próxima execução calculada; se der erro no `unschedule`, retornar mensagem clara e não sobrescrever settings.
- **Payload do digest não tem `weekendEvents` populado:** o helper novo (`getWeeklyEvents()`) roda dentro da edge function e injeta antes do render. Preview dry-run usa o mesmo caminho.
- **Templates antigos:** presets novos são novos registros; nenhum template existente é tocado.

## Pendências propositais (fora desta onda)

- Google Maps connector (bloco `static_map` em produção) — fica pra onda seguinte.
- Helper `getWeekendEvents()` real para o cron da quinta (Agenda do FDS automático) — depende da mesma infraestrutura, faço junto se você quiser aproveitar a viagem.

---

## Aprovação para começar

Posso iniciar por **D.3 (preview real)** — é a mudança mais rápida, menor risco e você já enxerga valor no mesmo deploy. Depois seguimos D.1.b → D.1.a → D.2.
