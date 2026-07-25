/**
 * Controles reutilizáveis do editor de blocos de e-mail.
 * Extraídos de EmailTemplateEditor.tsx (Onda 1 PR-A) sem mudança de comportamento.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Copy, Eye, EyeOff, Library } from 'lucide-react';
import { type Block } from '@/lib/emailTemplates/blocks';

// Controle reutilizável de alinhamento (esq/centro/dir)
export function AlignControl({
  value,
  onChange,
}: {
  value?: 'left' | 'center' | 'right';
  onChange: (v: 'left' | 'center' | 'right') => void;
}) {
  return (
    <div>
      <Label className="text-xs">Alinhamento</Label>
      <Select
        value={value || 'left'}
        onValueChange={(v) => onChange(v as 'left' | 'center' | 'right')}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Esquerda</SelectItem>
          <SelectItem value="center">Centro</SelectItem>
          <SelectItem value="right">Direita</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function ColorControl({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-14 rounded border cursor-pointer bg-transparent"
        />
        <Input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'auto'}
          className="font-mono text-xs h-9"
        />
      </div>
    </div>
  );
}

export function SortableRow({
  block,
  active,
  label,
  isGlobal,
  onSelect,
  onRemove,
  onDuplicate,
  onToggleHidden,
}: {
  block: Block;
  active: boolean;
  label: string;
  isGlobal: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onToggleHidden: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const hidden = (block as { hidden?: boolean }).hidden === true;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded border ${active ? 'border-primary bg-primary/10' : 'border-border bg-card'} ${hidden ? 'opacity-60' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground p-1"
        aria-label="Arrastar"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <button
        className={`flex-1 text-left text-sm truncate flex items-center gap-1.5 ${hidden ? 'line-through' : ''}`}
        onClick={onSelect}
      >
        {isGlobal && <Library className="w-3.5 h-3.5 shrink-0 text-primary" />}
        <span className="truncate">{label}</span>
        {hidden && (
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
            oculto
          </span>
        )}
      </button>
      <button
        className={`p-1 ${hidden ? 'text-muted-foreground' : 'text-foreground/70 hover:text-foreground'}`}
        onClick={onToggleHidden}
        aria-label={hidden ? 'Mostrar bloco' : 'Ocultar bloco'}
        title={
          hidden
            ? 'Mostrar bloco (aparece no preview e no envio)'
            : 'Ocultar bloco (some do preview e do envio)'
        }
      >
        {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
      <button
        className="text-muted-foreground hover:text-foreground p-1"
        onClick={onDuplicate}
        aria-label="Duplicar"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
      <button
        className="text-muted-foreground hover:text-red-500 p-1"
        onClick={onRemove}
        aria-label="Remover"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
