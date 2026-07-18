import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuthContext";

interface LikeButtonProps {
  postId: string;
  initialLikes: number;
}

export const LikeButton = ({ postId, initialLikes }: LikeButtonProps) => {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(initialLikes);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const checkIfLiked = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .rpc("user_liked_post", { post_id: postId });

      if (error) throw error;
      setLiked(data || false);
    } catch (error) {
      console.error("Error checking like status:", error);
    }
  }, [postId, user]);

  useEffect(() => {
    checkIfLiked();
  }, [checkIfLiked]);

  const handleLike = async () => {
    if (!user) {
      toast({
        title: "Login necessário",
        description: "Faça login para curtir posts",
        variant: "destructive",
      });
      return;
    }

    if (loading) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc("toggle_post_like", { post_id: postId });

      if (error) throw error;

      const result = data as { liked: boolean; total_likes: number };
      setLiked(result.liked);
      setLikes(result.total_likes);

      toast({
        title: result.liked ? "Post curtido!" : "Curtida removida",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao curtir post",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 sm:mb-8">
      <Button
        variant={liked ? "default" : "outline"}
        onClick={handleLike}
        disabled={loading}
        className={`gap-2 min-h-[48px] px-6 transition-all ${
          liked ? "bg-primary scale-105" : ""
        }`}
      >
        <Heart 
          className={`w-5 h-5 transition-all ${
            liked ? "fill-current animate-scale-in" : ""
          }`}
        />
        <span className="font-semibold">
          {likes} {likes === 1 ? "Curtida" : "Curtidas"}
        </span>
      </Button>
      
      <p className="text-xs sm:text-sm text-muted-foreground">
        {liked ? "Você curtiu este post" : user ? "Curta este post se você gostou" : "Faça login para curtir"}
      </p>
    </div>
  );
};
