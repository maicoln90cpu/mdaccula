import {
  ExternalLink,
  Instagram,
  Music,
  MessageCircle,
  Calendar,
  FileText,
  Mail,
  Youtube,
  Twitter,
  Facebook,
  Linkedin,
  Globe,
  Ticket,
  MapPin,
  Clock,
  Heart,
  Share2,
  Play,
  Headphones,
  Radio,
  Mic,
  Camera,
  Video,
  Phone,
  Star,
  Sparkles,
  Zap,
  Gift,
  ShoppingBag,
  Store,
  type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { getBrandColor } from '@/lib';

/**
 * Static icon map for common icons used in link cards
 * Eliminates lazy loading overhead from DynamicIcon
 * Falls back to ExternalLink for unknown icons
 */
const iconMap: Record<string, ComponentType<LucideProps>> = {
  // Default
  ExternalLink,
  externallink: ExternalLink,

  // Social
  Instagram,
  instagram: Instagram,
  Twitter,
  twitter: Twitter,
  Facebook,
  facebook: Facebook,
  Linkedin,
  linkedin: Linkedin,
  Youtube,
  youtube: Youtube,

  // Music
  Music,
  music: Music,
  Headphones,
  headphones: Headphones,
  Radio,
  radio: Radio,
  Mic,
  mic: Mic,
  Play,
  play: Play,

  // Communication
  MessageCircle,
  messagecircle: MessageCircle,
  'message-circle': MessageCircle,
  Mail,
  mail: Mail,
  Phone,
  phone: Phone,

  // Events
  Calendar,
  calendar: Calendar,
  Ticket,
  ticket: Ticket,
  Clock,
  clock: Clock,
  MapPin,
  mappin: MapPin,
  'map-pin': MapPin,

  // Media
  Camera,
  camera: Camera,
  Video,
  video: Video,

  // Misc
  FileText,
  filetext: FileText,
  'file-text': FileText,
  Globe,
  globe: Globe,
  Heart,
  heart: Heart,
  Share2,
  share2: Share2,
  Star,
  star: Star,
  Sparkles,
  sparkles: Sparkles,
  Zap,
  zap: Zap,
  Gift,
  gift: Gift,
  ShoppingBag,
  shoppingbag: ShoppingBag,
  'shopping-bag': ShoppingBag,
  Store,
  store: Store,
};

interface StaticIconProps extends Omit<LucideProps, 'ref'> {
  name: string;
}

/**
 * Static icon component that renders Lucide icons without lazy loading
 * Provides instant rendering for the ~30 most common icons
 */
export const StaticIcon = ({ name, style, ...props }: StaticIconProps) => {
  // Normalize icon name for lookup
  const normalizedName = name?.toLowerCase().replace(/\s+/g, '') || 'externallink';

  // Try exact match first, then normalized match
  const Icon = iconMap[name] || iconMap[normalizedName] || ExternalLink;

  // Recognizable platforms render in their real brand color; everything else keeps the inherited/theme color.
  const brandColor = getBrandColor(normalizedName);

  return <Icon style={brandColor ? { color: brandColor, ...style } : style} {...props} />;
};
