/**
 * Controles reutilizáveis do editor de blocos de e-mail.
 * Extraídos de EmailTemplateEditor.tsx (Onda 1 PR-A) sem mudança de comportamento.
 */
import { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Copy, Eye, EyeOff, Library, Bold, Italic, Link2, Pilcrow } from 'lucide-react';
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

/**
 * Editor de HTML com barra de formatação — negrito/itálico/link/parágrafo
 * inserem os códigos automaticamente na seleção, sem o usuário precisar
 * digitar as tags na mão. O bloco `text` continua salvando HTML puro
 * (mesmo formato que o renderer de e-mail já espera), só a edição fica
 * mais fácil.
 */
export function RichHtmlEditor({
  value,
  onChange,
  rows = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = (before: string, after: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const selected = el.value.slice(start, end);
    const next = el.value.slice(0, start) + before + selected + after + el.value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insertLink = () => {
    const url = window.prompt('URL do link:', 'https://');
    if (!url) return;
    wrapSelection(`<a href="${url}">`, '</a>');
  };

  const insertParagraphBreak = () => {
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart ?? el.value.length;
    const next = `${el.value.slice(0, pos)}</p>\n<p>${el.value.slice(pos)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos + 8, pos + 8);
    });
  };

  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <Button type="button" size="icon" variant="outline" className="h-7 w-7" title="Negrito" onClick={() => wrapSelection('<strong>', '</strong>')}>
          <Bold className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" size="icon" variant="outline" className="h-7 w-7" title="Itálico" onClick={() => wrapSelection('<em>', '</em>')}>
          <Italic className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" size="icon" variant="outline" className="h-7 w-7" title="Link" onClick={insertLink}>
          <Link2 className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" size="icon" variant="outline" className="h-7 w-7" title="Novo parágrafo" onClick={insertParagraphBreak}>
          <Pilcrow className="w-3.5 h-3.5" />
        </Button>
      </div>
      <Textarea
        ref={ref}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Selecione um texto e clique em Negrito/Itálico/Link — as tags são inseridas
        automaticamente. Tags de script, style, iframe e handlers on* são removidos.
      </p>
    </div>
  );
}
