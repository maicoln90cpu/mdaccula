-- Tabela de newsletter subscribers
CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  confirmed BOOLEAN DEFAULT false,
  confirmation_token TEXT,
  unsubscribed_at TIMESTAMPTZ,
  source TEXT -- 'popup', 'footer', 'contact'
);

CREATE INDEX idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX idx_newsletter_confirmed ON newsletter_subscribers(confirmed);

-- RLS policies
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe to newsletter"
  ON newsletter_subscribers
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all subscribers"
  ON newsletter_subscribers
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Adicionar spotify_playlist_id nas configurações do site
INSERT INTO site_settings (key, value) 
VALUES ('spotify_playlist_id', '')
ON CONFLICT (key) DO NOTHING;