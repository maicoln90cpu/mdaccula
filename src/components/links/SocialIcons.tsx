import { Instagram, Music, MessageCircle, Mail } from 'lucide-react';
import { getBrandColor } from '@/lib';

interface SocialIconsProps {
  instagramUrl?: string;
  soundcloudUrl?: string;
  whatsappUrl?: string;
  email?: string;
}

export const SocialIcons = ({
  instagramUrl,
  soundcloudUrl,
  whatsappUrl,
  email,
}: SocialIconsProps) => {
  const icons = [
    {
      icon: Instagram,
      url: instagramUrl,
      label: 'Instagram',
      color: getBrandColor('instagram'),
    },
    {
      icon: Music,
      url: soundcloudUrl,
      label: 'SoundCloud',
      color: getBrandColor('soundcloud'),
    },
    {
      icon: MessageCircle,
      url: whatsappUrl,
      label: 'WhatsApp',
      color: getBrandColor('whatsapp'),
    },
    {
      icon: Mail,
      url: email ? `mailto:${email}` : undefined,
      label: 'Email',
    },
  ];

  const visibleIcons = icons.filter((item) => item.url);

  if (visibleIcons.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-4 my-6">
      {visibleIcons.map((item) => {
        const Icon = item.icon;
        return (
          <a
            key={item.label}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-all hover:scale-110"
            aria-label={item.label}
          >
            <Icon className="w-6 h-6" style={item.color ? { color: item.color } : undefined} />
          </a>
        );
      })}
    </div>
  );
};
