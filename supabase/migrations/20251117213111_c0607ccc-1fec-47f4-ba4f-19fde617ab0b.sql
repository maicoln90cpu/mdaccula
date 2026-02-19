-- Create blog_post_likes table for tracking user likes
CREATE TABLE IF NOT EXISTS public.blog_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Enable RLS on blog_post_likes
ALTER TABLE public.blog_post_likes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own likes
CREATE POLICY "Users can view their own likes"
  ON public.blog_post_likes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own likes
CREATE POLICY "Users can insert their own likes"
  ON public.blog_post_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own likes
CREATE POLICY "Users can delete their own likes"
  ON public.blog_post_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to toggle blog post like
CREATE OR REPLACE FUNCTION public.toggle_post_like(post_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_liked BOOLEAN;
  v_total_likes INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Check if user already liked the post
  SELECT EXISTS(
    SELECT 1 FROM public.blog_post_likes 
    WHERE user_id = v_user_id AND blog_post_likes.post_id = toggle_post_like.post_id
  ) INTO v_liked;

  IF v_liked THEN
    -- Unlike: remove like
    DELETE FROM public.blog_post_likes 
    WHERE user_id = v_user_id AND blog_post_likes.post_id = toggle_post_like.post_id;
    
    -- Decrement likes count
    UPDATE public.blog_posts 
    SET likes = GREATEST(likes - 1, 0)
    WHERE id = toggle_post_like.post_id;
  ELSE
    -- Like: add like
    INSERT INTO public.blog_post_likes (user_id, post_id)
    VALUES (v_user_id, toggle_post_like.post_id);
    
    -- Increment likes count
    UPDATE public.blog_posts 
    SET likes = likes + 1
    WHERE id = toggle_post_like.post_id;
  END IF;

  -- Get updated total likes
  SELECT likes INTO v_total_likes 
  FROM public.blog_posts 
  WHERE id = toggle_post_like.post_id;

  RETURN jsonb_build_object(
    'liked', NOT v_liked,
    'total_likes', v_total_likes
  );
END;
$$;

-- Function to check if user liked a post
CREATE OR REPLACE FUNCTION public.user_liked_post(post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS(
    SELECT 1 FROM public.blog_post_likes 
    WHERE user_id = v_user_id AND blog_post_likes.post_id = user_liked_post.post_id
  );
END;
$$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_blog_post_likes_user_post 
  ON public.blog_post_likes(user_id, post_id);

CREATE INDEX IF NOT EXISTS idx_blog_post_likes_post 
  ON public.blog_post_likes(post_id);