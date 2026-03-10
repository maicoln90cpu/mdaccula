import { useState } from "react";
import { cn, parseLocalDate } from "@/lib/utils";
import { getThumbnailUrl } from "@/lib/imageUtils";
import { StaticIcon } from "./StaticIcon";

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
}: SimpleLinkCardProps) => {
  const [imgError, setImgError] = useState(false);

  const rawImage = imgError
    ? link.events?.image_url || null
    : link.thumbnail_url || link.events?.image_url || null;
  const resolvedImage = rawImage ? getThumbnailUrl(rawImage) : null;

  const style = {
    maxWidth: link.card_width ? `${Math.min(Math.max(link.card_width, 200), 650)}px` : '650px',
    width: '100%',
  };

  const iconName = link.icon || 'ExternalLink';

  const getCardColor = () => {
    if (link.color_gradient && link.color_gradient.includes('from-')) return link.color_gradient;
    if (templateCardColor && templateCardColor !== 'default' && templateCardColor !== '') return templateCardColor;
    if (link.events) return theme.cardEvent;
    if (groupName?.toLowerCase().includes('navega')) return theme.cardNavigation;
    return theme.cardDefault;
  };

  const getCardBorder = () => {
    if (templateBorderColor && templateBorderColor !== 'default' && templateBorderColor !== '') return templateBorderColor;
    return theme.cardBorder;
  };

  const renderFeaturedCard = () => (
    <div className="flex items-center gap-4 p-4 w-full h-full">
      {resolvedImage && (
        <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted/20 flex items-center justify-center">
          <img src={resolvedImage} alt={link.title} loading="lazy" decoding="async" onError={() => setImgError(true)} className="w-full h-full object-contain" />
        </div>
      )}
      <div className="flex-1 min-w-0 text-left space-y-1">
        <span className="font-bold text-xl break-words block">{link.title}</span>
        {(link.override_date || link.events?.date) && showEventDate && (
          <span className="text-sm font-semibold text-white/90 block">
            {parseLocalDate(link.override_date || link.events?.date).toLocaleDateString('pt-BR')} • {(link.override_time || link.events?.time || '00:00').slice(0, 5)}
          </span>
        )}
        {link.subtitle && <div className="text-sm opacity-80">{link.subtitle}</div>}
        {link.events && (
          <div className="text-xs opacity-70">
            {link.events.venue}, {link.events.location_city}/{link.events.location_state}
          </div>
        )}
      </div>
    </div>
  );

  const renderStandardCard = () => (
    <div className="flex items-center gap-3 flex-1 min-w-0 p-3">
      {resolvedImage ? (
        <div className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted/20 flex items-center justify-center">
          <img src={resolvedImage} alt={link.title} loading="lazy" decoding="async" onError={() => setImgError(true)} className="w-full h-full object-contain" />
        </div>
      ) : link.icon ? (
        <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center">
          <StaticIcon name={iconName} className="w-8 h-8" />
        </div>
      ) : null}
      {!resolvedImage && !link.icon && (
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
          <StaticIcon name={iconName} className="w-5 h-5" />
        </div>
      )}
      <div className="flex-1 min-w-0 text-left space-y-0.5">
        <span className="font-semibold text-base break-words block">{link.title}</span>
        {(link.override_date || link.events?.date) && showEventDate && (
          <span className="text-xs sm:text-sm font-semibold text-white/90 block">
            {parseLocalDate(link.override_date || link.events?.date).toLocaleDateString('pt-BR')} • {(link.override_time || link.events?.time || '00:00').slice(0, 5)}
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
    <div style={style} className="flex items-center gap-2 w-full">
      <button
        onClick={() => onLinkClick(link)}
        className={cn(
          "flex-1 bg-gradient-to-r",
          getCardColor(),
          link.is_featured
            ? "border-4 border-primary shadow-[0_0_20px_rgba(156,39,176,0.5)] ring-2 ring-primary/30"
            : getCardBorder(),
          link.is_featured ? "shadow-2xl" : theme.cardShadow,
          theme.cardRoundedness,
          theme.cardBackdrop,
          theme.cardHoverEffect,
          "transition-all duration-300"
        )}
        style={{
          minHeight: link.is_featured ? '120px' : `${Math.min(link.card_height || templateCardHeight || 80, 150)}px`,
          height: 'auto',
        }}
      >
        {link.is_featured ? renderFeaturedCard() : renderStandardCard()}
      </button>
    </div>
  );
};
