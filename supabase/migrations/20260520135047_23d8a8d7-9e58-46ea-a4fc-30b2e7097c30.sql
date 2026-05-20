ALTER PUBLICATION supabase_realtime ADD TABLE
  public.team_members,
  public.newsletter_subscribers,
  public.redirect_links,
  public.news_sources,
  public.ai_prompt_templates,
  public.recurring_event_configs,
  public.podcast_submissions,
  public.newsletter_popup_variants,
  public.event_templates,
  public.site_settings;

ALTER TABLE public.team_members REPLICA IDENTITY FULL;
ALTER TABLE public.newsletter_subscribers REPLICA IDENTITY FULL;
ALTER TABLE public.redirect_links REPLICA IDENTITY FULL;
ALTER TABLE public.news_sources REPLICA IDENTITY FULL;
ALTER TABLE public.ai_prompt_templates REPLICA IDENTITY FULL;
ALTER TABLE public.recurring_event_configs REPLICA IDENTITY FULL;
ALTER TABLE public.podcast_submissions REPLICA IDENTITY FULL;
ALTER TABLE public.newsletter_popup_variants REPLICA IDENTITY FULL;
ALTER TABLE public.event_templates REPLICA IDENTITY FULL;
ALTER TABLE public.site_settings REPLICA IDENTITY FULL;