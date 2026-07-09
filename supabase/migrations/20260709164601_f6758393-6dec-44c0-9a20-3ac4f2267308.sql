
-- Tabela de templates com sistema de blocos
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('event_new', 'ticket_batch', 'weekly_digest', 'custom')),
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  subject_template TEXT,
  preheader_template TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage templates"
  ON public.email_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Coluna para escolher template padrão em envio automático
ALTER TABLE public.egoi_config
  ADD COLUMN IF NOT EXISTS default_event_template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL;

-- Seed do template padrão "Novo evento" replicando o layout atual em blocos
INSERT INTO public.email_templates (name, type, is_default, subject_template, preheader_template, blocks)
VALUES (
  'Novo evento — padrão',
  'event_new',
  true,
  '{{event.title}} — {{event.date_label}}',
  '{{event.title}} — {{event.date_label}} em {{event.venue}}, {{event.city_state}}',
  '[
    {"id":"b1","kind":"header","logo_height":64},
    {"id":"b2","kind":"hero_image"},
    {"id":"b3","kind":"eyebrow","text":"Novo evento confirmado"},
    {"id":"b4","kind":"title"},
    {"id":"b5","kind":"subtitle"},
    {"id":"b6","kind":"event_meta"},
    {"id":"b7","kind":"description"},
    {"id":"b8","kind":"article_summary"},
    {"id":"b9","kind":"cta_button","label":"Garantir ingresso","url_field":"ticket_link"},
    {"id":"b10","kind":"secondary_link","label":"Ver agenda completa no site","url_field":"agenda_url"},
    {"id":"b11","kind":"social_icons","networks":[
      {"id":"instagram","label":"Instagram","url":"","enabled":true},
      {"id":"youtube","label":"YouTube","url":"","enabled":true},
      {"id":"tiktok","label":"TikTok","url":"","enabled":true},
      {"id":"soundcloud","label":"SoundCloud","url":"","enabled":false},
      {"id":"spotify","label":"Spotify","url":"","enabled":false},
      {"id":"linktree","label":"Linktree","url":"","enabled":false},
      {"id":"facebook","label":"Facebook","url":"","enabled":false},
      {"id":"twitter","label":"Twitter/X","url":"","enabled":false}
    ]},
    {"id":"b12","kind":"footer","include_unsubscribe":true}
  ]'::jsonb
);
