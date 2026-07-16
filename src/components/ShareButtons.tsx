import { Twitter, Facebook, Linkedin, Link2, MessageCircle, Send, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getBrandColor } from "@/lib";

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
}

interface SharePlatform {
  key: string;
  label: string;
  icon: LucideIcon;
  action: () => void;
}

export const ShareButtons = ({ url, title }: ShareButtonsProps) => {
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
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  const handleShare = (platform: string, link: string) => {
    window.open(link, "_blank", "noopener,noreferrer");
    trackShare(platform);
  };

  const platforms: SharePlatform[] = [
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, action: () => handleShare("whatsapp", shareLinks.whatsapp) },
    { key: "twitter", label: "Twitter", icon: Twitter, action: () => handleShare("twitter", shareLinks.twitter) },
    { key: "facebook", label: "Facebook", icon: Facebook, action: () => handleShare("facebook", shareLinks.facebook) },
    { key: "linkedin", label: "LinkedIn", icon: Linkedin, action: () => handleShare("linkedin", shareLinks.linkedin) },
    { key: "telegram", label: "Telegram", icon: Send, action: () => handleShare("telegram", shareLinks.telegram) },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {platforms.map((p) => {
        const Icon = p.icon;
        const color = getBrandColor(p.key);
        return (
          <button
            key={p.key}
            onClick={p.action}
            aria-label={`Compartilhar no ${p.label}`}
            title={p.label}
            className="share-icon-btn w-10 h-10 rounded-full border border-border flex items-center justify-center transition-all duration-300 hover:scale-110"
            style={{ color, ["--glow-color" as string]: color }}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
      <button
        onClick={copyToClipboard}
        aria-label="Copiar link"
        title="Copiar link"
        className="share-icon-btn w-10 h-10 rounded-full border border-border flex items-center justify-center transition-all duration-300 hover:scale-110"
      >
        <Link2 className="w-4 h-4" />
      </button>
    </div>
  );
};
