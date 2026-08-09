-- Melhoria: Blog news (blog-digest-draft) nunca gravava em
-- event_email_campaigns — não tem como, já que ele não é ligado a um
-- evento específico (agrega posts do blog) e event_id era NOT NULL. Isso
-- deixava essa automação completamente invisível no Dashboard de e-mails.
-- Remover a constraint permite gravar uma linha com event_id = null pra
-- esse (e qualquer outro) tipo de campanha sem evento associado.
ALTER TABLE public.event_email_campaigns ALTER COLUMN event_id DROP NOT NULL;
