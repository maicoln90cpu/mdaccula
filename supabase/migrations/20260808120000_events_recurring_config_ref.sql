-- Item 5 da melhoria de disparo de e-mail — a nova automação "Lembrete de
-- evento" (enviar e-mail X dias antes da data) precisa excluir eventos
-- gerados por recorrência (recurring_event_configs). Hoje não existe
-- nenhuma forma de saber, olhando só a tabela events, se uma linha foi
-- criada automaticamente por create-recurring-events ou cadastrada
-- manualmente — esta coluna fecha esse gap.
--
-- Eventos recorrentes já existentes ficam NULL (não dá pra saber
-- retroativamente qual config os gerou) — aceitável, eles só passam a ser
-- reconhecidos como recorrentes a partir da próxima geração automática.

ALTER TABLE public.events
  ADD COLUMN recurring_event_config_id UUID REFERENCES public.recurring_event_configs(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.events.recurring_event_config_id IS
  'Preenchido por create-recurring-events quando o evento foi gerado automaticamente a partir de uma config recorrente. NULL = evento cadastrado manualmente (ou recorrente criado antes desta coluna existir). Usado pela automação "Lembrete de evento" (site_settings.event_reminder_*) para excluir recorrentes.';

-- Acelera a query da automação (eventos ativos, não-recorrentes, por data).
CREATE INDEX IF NOT EXISTS idx_events_reminder_candidates
  ON public.events (date)
  WHERE recurring_event_config_id IS NULL AND status = 'active';
