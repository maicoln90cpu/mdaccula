import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn, parseLocalDate } from "@/lib/utils";
import { getThumbnailUrl } from "@/lib/imageUtils";
import { CopyPlus, Edit } from "lucide-react";
import { StaticIcon } from "./StaticIcon";

interface LinkEvent {
  venue: string;
  location_city: string;
  location_state: string;
  date: string;
  time: string;
  image_url?: string | null;
}

interface CustomLink {
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

interface SortableLinkCardProps {
  link: CustomLink;
  onLinkClick: (link: CustomLink) => void;
  onEdit: (link: CustomLink) => void;
  onDuplicate: (link: CustomLink) => void;
  theme: Theme;
  isAdmin: boolean;
  groupName: string;
  showEventDate: boolean;
  templateCardColor: string;
  templateBorderColor: string;
  templateCardHeight: number;
}

export const SortableLinkCard = ({
  link,
  onLinkClick,
  onEdit,
  onDuplicate,
  theme,
  isAdmin,
  groupName,
  showEventDate,
  templateCardColor,
  templateBorderColor,
  templateCardHeight
}: SortableLinkCardProps) => {
  const [imgError, setImgError] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
    data: { groupId: link.group_id },
    disabled: !isAdmin
  });

  // Resolve image: thumbnail_url first, then event image_url as fallback
  const rawImage = imgError ?
  link.events?.image_url || null :
  link.thumbnail_url || link.events?.image_url || null;
  const resolvedImage = rawImage ? getThumbnailUrl(rawImage) : null;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    maxWidth: link.card_width ? `${Math.min(Math.max(link.card_width, 200), 650)}px` : '650px',
    width: '100%'
  };

  const iconName = link.icon || 'ExternalLink';

  // Color hierarchy:
  // 1. Individual link gradient (highest priority)
  // 2. Template color (if configured)
  // 3. Theme-based context colors (fallback)
  const getCardColor = () => {
    if (link.color_gradient && link.color_gradient.includes('from-')) {
      return link.color_gradient;
    }
    if (templateCardColor && templateCardColor !== 'default' && templateCardColor !== '') {
      return templateCardColor;
    }
    if (link.events) return theme.cardEvent;
    if (groupName?.toLowerCase().includes('navega')) return theme.cardNavigation;
    return theme.cardDefault;
  };

  // Border hierarchy:
  // 1. Template border color (if configured)
  // 2. Theme border style (fallback)
  const getCardBorder = () => {
    if (templateBorderColor && templateBorderColor !== 'default' && templateBorderColor !== '') {
      return templateBorderColor;
    }
    return theme.cardBorder;
  };

  const renderFeaturedCard = () =>
  <div className="flex items-center gap-4 p-4 w-full h-full">
      {resolvedImage &&
    <div className="w-20 sm:w-24 h-20 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted/20 flex items-center justify-center">
      <img
        src={resolvedImage}
        alt={link.title}
        loading="lazy"
        decoding="async"
        onError={() => setImgError(true)}
        className="w-full h-full object-contain" />
    </div>
    }
      
      <div className="flex-1 min-w-0 text-left space-y-1">
        <span className="font-bold text-xl break-words block">{link.title}</span>
        {(link.override_date || link.events?.date) && showEventDate &&
      <span className="text-sm font-semibold text-white/90 block">
            {parseLocalDate(link.override_date || link.events?.date).toLocaleDateString('pt-BR')} • {(link.override_time || link.events?.time || '00:00').slice(0, 5)}
          </span>
      }
        {link.subtitle &&
      <div className="text-sm opacity-80">
            {link.subtitle}
          </div>
      }
        {link.events &&
      <div className="text-xs opacity-70">
            {link.events.venue}, {link.events.location_city}/{link.events.location_state}
          </div>
      }
      </div>
    </div>;


  const renderStandardCard = () =>
  <div className="flex items-center gap-3 flex-1 min-w-0 p-3">
      {resolvedImage ?
    <div className="w-14 sm:w-16 flex-shrink-0 rounded-md bg-muted/20 flex items-center justify-center">
      <img
        src={resolvedImage}
        alt={link.title}
        loading="lazy"
        decoding="async"
        onError={() => setImgError(true)}
        className="w-full h-auto object-contain" />
    </div> :

    link.icon ?
    <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center">
          <StaticIcon name={iconName} className="w-8 h-8" />
        </div> :
    null}
      {!resolvedImage && !link.icon &&
    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
          <StaticIcon name={iconName} className="w-5 h-5" />
        </div>
    }
      <div className="flex-1 min-w-0 text-left space-y-0.5">
        <span className="font-semibold text-base break-words block">{link.title}</span>
        {(link.override_date || link.events?.date) && showEventDate &&
      <span className="text-xs sm:text-sm font-semibold text-white/90 block">
            {parseLocalDate(link.override_date || link.events?.date).toLocaleDateString('pt-BR')} • {(link.override_time || link.events?.time || '00:00').slice(0, 5)}
          </span>
      }
        {link.subtitle &&
      <div className="text-xs opacity-80 truncate">
            {link.subtitle}
          </div>
      }
        {link.events &&
      <div className="text-xs opacity-70 truncate">
            {link.events.venue}, {link.events.location_city}/{link.events.location_state}
          </div>
      }
      </div>
    </div>;


  return (
    <div ref={setNodeRef} style={style} {...attributes} className="flex items-center gap-2 w-full">
      <button
        {...isAdmin ? listeners : {}}
        onClick={() => onLinkClick(link)}
        className={cn(
          "flex-1 bg-gradient-to-r",
          getCardColor(),
          link.is_featured ?
          "border-4 border-primary shadow-[0_0_20px_rgba(156,39,176,0.5)] ring-2 ring-primary/30" :
          getCardBorder(),
          link.is_featured ?
          "shadow-2xl" :
          theme.cardShadow,
          theme.cardRoundedness,
          theme.cardBackdrop,
          theme.cardHoverEffect,
          "transition-all duration-300",
          isDragging && "opacity-50 scale-95"
        )}
        style={{
          minHeight: link.is_featured ? '120px' : `${Math.min(link.card_height || templateCardHeight || 80, 150)}px`,
          height: 'auto'
        }}>

        {link.is_featured ? renderFeaturedCard() : renderStandardCard()}
      </button>
      
      {isAdmin &&
      <div className="flex gap-2">
          <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(link);
          }}
          className="flex-shrink-0 w-10 h-10 rounded-lg bg-secondary/20 hover:bg-secondary/30 border border-secondary/30 flex items-center justify-center transition-colors"
          title="Duplicar link">

            <CopyPlus className="w-4 h-4 text-secondary-foreground" />
          </button>
          <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(link);
          }}
          className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/30 flex items-center justify-center transition-colors"
          title="Editar link">

            <Edit className="w-4 h-4 text-primary" />
          </button>
        </div>
      }
    </div>);

};