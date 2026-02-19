import { Share2, Twitter, Facebook, Linkedin, Link2, MessageCircle, Send } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { supabase } from "@/integrations/supabase/client";

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
}

export const ShareButtons = ({ url, title, description }: ShareButtonsProps) => {
  const fullUrl = `${window.location.origin}${url}`;

  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title}\n\n${fullUrl}`)}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(title)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullUrl)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(title)}`,
  };

  const trackShare = async (platform: string) => {
    try {
      await supabase.functions.invoke("track-share", {
        body: { url, platform },
      });
    } catch (error) {
      console.error("Error tracking share:", error);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast.success("Link copiado!");
      trackShare("copy");
    } catch (err) {
      toast.error("Erro ao copiar link");
    }
  };

  const handleShare = (platform: string, link: string) => {
    window.open(link, "_blank", "noopener,noreferrer");
    trackShare(platform);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="w-4 h-4 mr-2" />
          Compartilhar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-semibold mb-3">Compartilhar</h4>

          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => handleShare("whatsapp", shareLinks.whatsapp)}
          >
            <MessageCircle className="w-4 h-4 mr-2 text-green-600" />
            WhatsApp
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => handleShare("twitter", shareLinks.twitter)}
          >
            <Twitter className="w-4 h-4 mr-2 text-blue-400" />
            Twitter
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => handleShare("facebook", shareLinks.facebook)}
          >
            <Facebook className="w-4 h-4 mr-2 text-blue-600" />
            Facebook
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => handleShare("linkedin", shareLinks.linkedin)}
          >
            <Linkedin className="w-4 h-4 mr-2 text-blue-700" />
            LinkedIn
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => handleShare("telegram", shareLinks.telegram)}
          >
            <Send className="w-4 h-4 mr-2 text-blue-500" />
            Telegram
          </Button>

          <hr className="my-2" />

          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={copyToClipboard}
          >
            <Link2 className="w-4 h-4 mr-2" />
            Copiar link
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
