import { Button } from '@/components/ui/button';
import {
  GripVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  CopyPlus,
  FolderPlus,
  RotateCcw,
} from 'lucide-react';
import { SortableItem } from '@/components/links/SortableItem';
import type { CustomLink } from './types';

interface LinkRowProps {
  link: CustomLink;
  onToggleEnabled: (linkId: string, enabled: boolean) => void;
  onResetManualOrder: (linkId: string) => void;
  onRequestAddToGroup: (link: CustomLink) => void;
  onDuplicate: (link: CustomLink) => void;
  onEdit: (link: CustomLink) => void;
  onRequestDelete: (linkId: string) => void;
}

export const LinkRow = ({
  link,
  onToggleEnabled,
  onResetManualOrder,
  onRequestAddToGroup,
  onDuplicate,
  onEdit,
  onRequestDelete,
}: LinkRowProps) => (
  <div
    className={`flex items-center justify-between p-3 rounded-lg border bg-card ${!link.enabled ? 'opacity-50' : ''}`}
  >
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <SortableItem id={link.id}>
        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab flex-shrink-0" />
      </SortableItem>
      {link.thumbnail_url && (
        <img
          src={link.thumbnail_url}
          alt={link.title}
          className="w-10 h-10 rounded object-cover flex-shrink-0"
          loading="lazy"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{link.title}</p>
          {link.manual_order_override && (
            <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
              manual
            </span>
          )}
        </div>
        {link.events?.date && (
          <p className="text-xs text-primary font-medium">
            📅 {new Date(link.events.date + 'T00:00:00').toLocaleDateString('pt-BR')} •{' '}
            {link.events.time?.slice(0, 5) || ''}
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
        title={link.enabled ? 'Desativar' : 'Ativar'}
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
        onClick={() => onRequestAddToGroup(link)}
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
      <Button variant="ghost" size="icon" onClick={() => onEdit(link)} title="Editar">
        <Edit className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRequestDelete(link.id)}
        title="Excluir"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  </div>
);

export default LinkRow;
