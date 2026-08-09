-- Auditoria da rota de Gestão de E-mails (agosto/2026): o campo "Dias antes
-- do evento" (Configuração > Modo agendado) só era validado no cliente via
-- atributos HTML min/max do input, que não impedem colar/digitar um valor
-- fora do intervalo (ex.: -5 ou 999) — o valor ia pro banco sem checagem
-- nenhuma. Trava também no banco como segunda camada de defesa.
ALTER TABLE public.egoi_config
  ADD CONSTRAINT egoi_config_scheduled_days_before_range
  CHECK (scheduled_days_before IS NULL OR (scheduled_days_before BETWEEN 1 AND 30));
