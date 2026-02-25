/**
 * VirtualizedLinkList - Lista virtualizada de links para performance
 * Renderiza apenas os itens visíveis na viewport
 */
import { useRef } from "react";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { GripVertical, Eye, EyeOff, RotateCcw, FolderPlus, CopyPlus, Edit, Trash2 } from "lucide-react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableItem } from "@/components/links/SortableItem";

interface LinkEvent {
  date: string;
  time: string;
  end_time?: string | null;
}

interface CustomLink {
  id: string;
  title: string;
  url: string;
  group_id: string | null;
  thumbnail_url: string | null;
  icon: string;
  color_gradient: string;
  clicks: number;
  enabled: boolean;
  display_order: number;
  is_internal: boolean;
  subtitle?: string | null;
  is_featured?: boolean;
  card_height?: number;
  card_width?: number;
  event_id?: string | null;
  events?: LinkEvent | null;
  manual_order_override?: boolean;
}

interface VirtualizedLinkListProps {
  links: CustomLink[];
  onToggleEnabled: (linkId: string, enabled: boolean) => void;
  onResetManualOrder: (linkId: string) => void;
  onAddToGroup: (link: CustomLink) => void;
  onDuplicate: (link: CustomLink) => void;
  onEdit: (link: CustomLink) => void;
  onDelete: (linkId: string) => void;
}

const ITEM_HEIGHT = 72; // Estimated height of each link item in pixels

export const VirtualizedLinkList = ({
  links,
  onToggleEnabled,
  onResetManualOrder,
  onAddToGroup,
  onDuplicate,
  onEdit,
  onDelete,
}: VirtualizedLinkListProps) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // Only virtualize if we have more than 20 items
  const shouldVirtualize = links.length > 20;

  const virtualizer = useVirtualizer({
    count: links.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5, // Render 5 extra items above/below viewport
  });

  const renderLinkItem = (link: CustomLink, style?: React.CSSProperties) => (
    <div
      key={link.id}
      style={style}
      className={`flex items-center justify-between p-3 rounded-lg border bg-card ${!link.enabled ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <SortableItem id={link.id}>
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab flex-shrink-0" />
        </SortableItem>
        {link.thumbnail_url && (
          <img 
            src={getOptimizedImageUrl(link.thumbnail_url)} 
            alt={link.title} 
            className="w-10 h-10 rounded object-contain flex-shrink-0"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{link.title}</p>
            {link.manual_order_override && (
              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">manual</span>
            )}
          </div>
          {link.events?.date && (
            <p className="text-xs text-primary font-medium">
              📅 {new Date(link.events.date + 'T00:00:00').toLocaleDateString('pt-BR')} • {link.events.time?.slice(0, 5) || ''}
            </p>
          )}
          <p className="text-xs text-muted-foreground truncate">{link.url}</p>
          <p className="text-xs text-muted-foreground">👁️ {link.clicks} clicks</p>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleEnabled(link.id, link.enabled)}
          title={link.enabled ? "Desativar" : "Ativar"}
        >
          {link.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </Button>
        {link.manual_order_override && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onResetManualOrder(link.id)}
            title="Resetar ordenação manual"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onAddToGroup(link)}
          title="Adicionar a outro grupo"
        >
          <FolderPlus className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDuplicate(link)}
          title="Duplicar"
        >
          <CopyPlus className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(link)}
          title="Editar"
        >
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(link.id)}
          title="Excluir"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  // For small lists, render without virtualization (simpler, supports DnD better)
  if (!shouldVirtualize) {
    return (
      <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {links.map((link) => renderLinkItem(link))}
        </div>
      </SortableContext>
    );
  }

  // For large lists, use virtualization
  return (
    <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
      <div 
        ref={parentRef} 
        className="max-h-[500px] overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const link = links[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {renderLinkItem(link)}
              </div>
            );
          })}
        </div>
      </div>
    </SortableContext>
  );
};

export default VirtualizedLinkList;
