-- Add token tracking fields to ai_generated_posts table
ALTER TABLE ai_generated_posts 
ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
ADD COLUMN IF NOT EXISTS total_tokens INTEGER;