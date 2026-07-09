
CREATE TABLE IF NOT EXISTS public.email_template_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  brand_name TEXT NOT NULL DEFAULT 'MDACCULA',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#a855f7',
  accent_color TEXT NOT NULL DEFAULT '#ec4899',
  background_color TEXT NOT NULL DEFAULT '#050505',
  footer_text TEXT NOT NULL DEFAULT 'Você recebeu este e-mail porque assinou a lista MDAccula — agenda cultural de música eletrônica de Cuiabá-MT.',
  cta_label TEXT NOT NULL DEFAULT 'Garantir ingresso',
  instagram_url TEXT DEFAULT 'https://instagram.com/mdaccula',
  youtube_url TEXT DEFAULT 'https://youtube.com/@mdaccula',
  tiktok_url TEXT DEFAULT 'https://tiktok.com/@mdaccula',
  show_subtitle BOOLEAN NOT NULL DEFAULT true,
  show_description BOOLEAN NOT NULL DEFAULT true,
  show_socials BOOLEAN NOT NULL DEFAULT true,
  show_secondary_link BOOLEAN NOT NULL DEFAULT true,
  secondary_link_label TEXT NOT NULL DEFAULT 'Ver agenda completa no site',
  custom_html_header TEXT,
  custom_html_footer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_template_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_template_settings TO authenticated;
GRANT ALL ON public.email_template_settings TO service_role;

ALTER TABLE public.email_template_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read email template settings"
  ON public.email_template_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert email template settings"
  ON public.email_template_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email template settings"
  ON public.email_template_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete email template settings"
  ON public.email_template_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_update_email_template_settings_updated_at
  BEFORE UPDATE ON public.email_template_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed da linha singleton com defaults
INSERT INTO public.email_template_settings (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;
