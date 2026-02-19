-- Fix search_path for toggle_post_like function
CREATE OR REPLACE FUNCTION public.toggle_post_like(post_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Fix search_path for user_liked_post function
CREATE OR REPLACE FUNCTION public.user_liked_post(post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Fix search_path for increment_post_views function
CREATE OR REPLACE FUNCTION public.increment_post_views(post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.blog_posts 
  SET views = views + 1 
  WHERE id = post_id;
END;
$$;

-- Fix search_path for increment_event_views function
CREATE OR REPLACE FUNCTION public.increment_event_views(event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.events 
  SET views = COALESCE(views, 0) + 1 
  WHERE id = event_id;
END;
$$;