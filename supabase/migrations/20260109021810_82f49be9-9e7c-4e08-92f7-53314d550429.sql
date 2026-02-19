-- Create recurring_event_configs table
CREATE TABLE public.recurring_event_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  venue TEXT NOT NULL,
  address TEXT,
  location_city TEXT NOT NULL,
  location_state TEXT NOT NULL,
  time TIME NOT NULL,
  end_time TIME,
  subtitle TEXT,
  description TEXT,
  genres TEXT[] DEFAULT '{}',
  ticket_link TEXT,
  vip_link TEXT,
  image_url TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurring_event_configs ENABLE ROW LEVEL SECURITY;

-- Admin policy
CREATE POLICY "Admins can manage recurring configs" ON public.recurring_event_configs
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_recurring_event_configs_updated_at
  BEFORE UPDATE ON public.recurring_event_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert initial D.EDGE recurring events
INSERT INTO public.recurring_event_configs (name, title, weekday, venue, address, location_city, location_state, time, end_time, subtitle, genres, ticket_link, vip_link, image_url) VALUES
  ('Moving', 'D.EDGE Moving', 4, 'D.EDGE', 'Rua Rego Barros, 490', 'São Paulo', 'SP', '23:59', NULL, NULL, ARRAY['Techno', 'Eletrônica'], 'https://d-edge.com.br/ingressos', 'https://d-edge.com.br/vip', 'https://nzbyyuqvhrwatmydxiag.supabase.co/storage/v1/object/public/event-images/0.8762608676338589.webp'),
  ('FreakChic', 'D.EDGE apres. FreakChic', 5, 'D.EDGE', 'Rua Rego Barros, 490', 'São Paulo', 'SP', '23:59', NULL, NULL, ARRAY['Techno', 'Eletrônica'], 'https://d-edge.com.br/ingressos', 'https://d-edge.com.br/vip', 'https://nzbyyuqvhrwatmydxiag.supabase.co/storage/v1/object/public/event-images/0.8762608676338589.webp'),
  ('Nave', 'D.EDGE apres. Nave', 6, 'D.EDGE', 'Rua Rego Barros, 490', 'São Paulo', 'SP', '23:59', NULL, NULL, ARRAY['Techno', 'Eletrônica'], 'https://d-edge.com.br/ingressos', 'https://d-edge.com.br/vip', 'https://nzbyyuqvhrwatmydxiag.supabase.co/storage/v1/object/public/event-images/0.8762608676338589.webp'),
  ('SuperAfter', 'D.EDGE apres. SuperAfter', 0, 'D.EDGE', 'Rua Rego Barros, 490', 'São Paulo', 'SP', '05:00', NULL, NULL, ARRAY['Techno', 'Eletrônica'], 'https://d-edge.com.br/ingressos', 'https://d-edge.com.br/vip', 'https://nzbyyuqvhrwatmydxiag.supabase.co/storage/v1/object/public/event-images/0.8762608676338589.webp');