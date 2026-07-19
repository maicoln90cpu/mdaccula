import { motion, useReducedMotion } from 'framer-motion';
import { cn, parseLocalDate } from '@/lib/utils';
import { LinkCardImage } from './LinkCardImage';

interface LinkEvent {
  venue: string;
  location_city: string;
  location_state: string;
  date: string;
  time: string;
  image_url?: string | null;
}

interface SimpleLink {
  id: string;
  title: string;
  subtitle?: string | null;
  url: string;
  thumbnail_url: string | null;
  icon: string;
  color_gradient: string;
  clicks: number;
  enabled: boolean;
  is_internal: boolean;
  is_featured?: boolean;
  display_order: number;
  card_height?: number;
  card_width?: number;
  group_id?: string;
  event_id?: string | null;
  override_date?: string | null;
  override_time?: string | null;
  events?: LinkEvent | null;
}

interface Theme {
  cardEvent: string;
  cardNavigation: string;
  cardDefault: string;
  cardBorder: string;
  cardShadow: string;
  cardRoundedness: string;
  cardBackdrop: string;
  cardHoverEffect: string;
}

interface SimpleLinkCardProps {
  link: SimpleLink;
  onLinkClick: (link: SimpleLink) => void;
  theme: Theme;
  groupName: string;
  showEventDate: boolean;
  templateCardColor: string;
  templateBorderColor: string;
  templateCardHeight: number;
  /** Position within its list — drives the entrance stagger delay. */
  index?: number;
}

export const SimpleLinkCard = ({
  link,
  onLinkClick,
  theme,
  groupName,
  showEventDate,
  templateCardColor,
  templateBorderColor,
  templateCardHeight,
  index = 0,
}: SimpleLinkCardProps) => {
  const prefersReducedMotion = useReducedMotion();
  const style = {
    maxWidth: link.card_width ? `${Math.min(Math.max(link.card_width, 200), 650)}px` : '650px',
    width: '100%',
  };

  const getCardColor = () => {
    if (link.color_gradient && link.color_gradient.includes('from-')) return link.color_gradient;
    if (templateCardColor && templateCardColor !== 'default' && templateCardColor !== '')
      return templateCardColor;
    if (link.events) return theme.cardEvent;
    if (groupName?.toLowerCase().includes('navega')) return theme.cardNavigation;
    return theme.cardDefault;
  };

  const getCardBorder = () => {
    if (templateBorderColor && templateBorderColor !== 'default' && templateBorderColor !== '')
      return templateBorderColor;
    return theme.cardBorder;
  };

  const renderFeaturedCard = () => (
    <div className="flex items-center gap-4 p-4 w-full h-full">
      <LinkCardImage
        thumbnailUrl={link.thumbnail_url}
        fallbackUrl={link.events?.image_url}
        alt={link.title}
        iconName={link.icon || 'ExternalLink'}
        featured
      />
      <div className="flex-1 min-w-0 text-left space-y-1">
        <span className="font-bold text-xl break-words block">{link.title}</span>
        {(link.override_date || link.events?.date) && showEventDate && (
          <span className="text-sm font-semibold text-white/90 block">
            {parseLocalDate(link.override_date || link.events?.date).toLocaleDateString('pt-BR')} •{' '}
            {(link.override_time || link.events?.time || '00:00').slice(0, 5)}
          </span>
        )}
        {link.subtitle && <div className="text-sm opacity-80">{link.subtitle}</div>}
        {link.events && (
          <div className="text-xs opacity-70 truncate">
            {link.events.venue}, {link.events.location_city}/{link.events.location_state}
          </div>
        )}
      </div>
    </div>
  );

  const renderStandardCard = () => (
    <div className="flex items-center gap-3 flex-1 min-w-0 p-3">
      <LinkCardImage
        thumbnailUrl={link.thumbnail_url}
        fallbackUrl={link.events?.image_url}
        alt={link.title}
        iconName={link.icon || 'ExternalLink'}
      />
      <div className="flex-1 min-w-0 text-left space-y-0.5">
        <span className="font-semibold text-base break-words block">{link.title}</span>
        {(link.override_date || link.events?.date) && showEventDate && (
          <span className="text-xs sm:text-sm font-semibold text-white/90 block">
            {parseLocalDate(link.override_date || link.events?.date).toLocaleDateString('pt-BR')} •{' '}
            {(link.override_time || link.events?.time || '00:00').slice(0, 5)}
          </span>
        )}
        {link.subtitle && <div className="text-xs opacity-80 truncate">{link.subtitle}</div>}
        {link.events && (
          <div className="text-xs opacity-70 truncate">
            {link.events.venue}, {link.events.location_city}/{link.events.location_state}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      style={style}
      className="flex items-center gap-2 w-full"
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: prefersReducedMotion ? 0 : Math.min(index, 10) * 0.04,
        ease: 'easeOut',
      }}
    >
      <button
        onClick={() => onLinkClick(link)}
        className={cn(
          'relative overflow-hidden link-card-shine flex-1 min-w-0 bg-gradient-to-r',
          getCardColor(),
          link.is_featured
            ? 'border-4 border-primary animate-featured-glow-pulse ring-2 ring-primary/30'
            : getCardBorder(),
          link.is_featured ? 'shadow-2xl' : theme.cardShadow,
          theme.cardRoundedness,
          theme.cardBackdrop,
          theme.cardHoverEffect,
          'transition-all duration-300'
        )}
        style={{
          minHeight: link.is_featured
            ? '120px'
            : `${Math.min(link.card_height || templateCardHeight || 80, 150)}px`,
          height: 'auto',
        }}
      >
        {link.is_featured ? renderFeaturedCard() : renderStandardCard()}
      </button>
    </motion.div>
  );
};
