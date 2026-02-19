-- Limpar dados antigos de analytics (>90 dias)
DELETE FROM share_analytics WHERE shared_at < NOW() - INTERVAL '90 days';
DELETE FROM newsletter_popup_analytics WHERE created_at < NOW() - INTERVAL '90 days';

-- Limpar prompt_used antigo em ai_generated_posts (>30 dias)
UPDATE ai_generated_posts SET prompt_used = NULL WHERE generated_at < NOW() - INTERVAL '30 days' AND prompt_used IS NOT NULL;

-- Reindex search_vector (nome correto do índice)
REINDEX INDEX idx_blog_posts_search;