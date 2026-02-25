
-- Tabela de eventos de clique em links (custom_links)
CREATE TABLE public.link_click_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id uuid NOT NULL REFERENCES public.custom_links(id) ON DELETE CASCADE,
  clicked_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_hash text
);

-- Tabela de eventos de visualização de blog posts
CREATE TABLE public.blog_view_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_hash text
);

-- Tabela de eventos de visualização de eventos
CREATE TABLE public.event_view_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_hash text
);

-- Índices para queries por período
CREATE INDEX idx_link_click_events_clicked_at ON public.link_click_events(clicked_at);
CREATE INDEX idx_link_click_events_link_id ON public.link_click_events(link_id);
CREATE INDEX idx_blog_view_events_viewed_at ON public.blog_view_events(viewed_at);
CREATE INDEX idx_blog_view_events_post_id ON public.blog_view_events(post_id);
CREATE INDEX idx_event_view_events_viewed_at ON public.event_view_events(viewed_at);
CREATE INDEX idx_event_view_events_event_id ON public.event_view_events(event_id);

-- RLS
ALTER TABLE public.link_click_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_view_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_view_events ENABLE ROW LEVEL SECURITY;

-- Admins podem ver os eventos de tracking
CREATE POLICY "Admins can view link click events" ON public.link_click_events FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can view blog view events" ON public.blog_view_events FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can view event view events" ON public.event_view_events FOR SELECT USING (public.is_admin());

-- Service role pode inserir (usado pelas edge functions)
CREATE POLICY "Service role can manage link_click_events" ON public.link_click_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage blog_view_events" ON public.blog_view_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage event_view_events" ON public.event_view_events FOR ALL USING (true) WITH CHECK (true);

-- Qualquer pessoa pode inserir eventos de tracking (anônimo)
CREATE POLICY "Anyone can insert link clicks" ON public.link_click_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert blog views" ON public.blog_view_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert event views" ON public.event_view_events FOR INSERT WITH CHECK (true);
