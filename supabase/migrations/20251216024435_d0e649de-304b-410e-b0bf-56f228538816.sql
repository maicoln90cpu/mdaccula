-- Adicionar ON DELETE SET NULL para ai_generated_posts.blog_post_id
ALTER TABLE ai_generated_posts
DROP CONSTRAINT IF EXISTS ai_generated_posts_blog_post_id_fkey;

ALTER TABLE ai_generated_posts
ADD CONSTRAINT ai_generated_posts_blog_post_id_fkey 
FOREIGN KEY (blog_post_id) 
REFERENCES blog_posts(id) 
ON DELETE SET NULL;

-- Adicionar ON DELETE CASCADE para blog_post_likes.post_id
ALTER TABLE blog_post_likes
DROP CONSTRAINT IF EXISTS blog_post_likes_post_id_fkey;

ALTER TABLE blog_post_likes
ADD CONSTRAINT blog_post_likes_post_id_fkey 
FOREIGN KEY (post_id) 
REFERENCES blog_posts(id) 
ON DELETE CASCADE;