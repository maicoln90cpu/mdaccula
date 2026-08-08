/**
 * Controles reutilizáveis do editor de blocos de e-mail.
 * Extraídos de EmailTemplateEditor.tsx (Onda 1 PR-A) sem mudança de comportamento.
 */
import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { GripVertical, Trash2, Copy, Eye, EyeOff, Library, Bold, Italic, Link2, Heading2, List, Quote } from 'lucide-react';
import { type Block } from '@/lib/emailTemplates/blocks';

// Controle reutilizável de alinhamento (esq/centro/dir). `defaultAlign` deve
// espelhar o padrão real do renderer daquele bloco quando `align` não foi
// salvo — sem isso, o Select mostra "Esquerda" mesmo em blocos cujo e-mail
// já sai centralizado, dando a falsa impressão de que o editor não lê o
// valor salvo (regressão descrita: "editor tá esquerda, preview tá centro").
export function AlignControl({
  value,
  onChange,
  defaultAlign = 'left',
}: {
  value?: 'left' | 'center' | 'right';
  onChange: (v: 'left' | 'center' | 'right') => void;
  defaultAlign?: 'left' | 'center' | 'right';
}) {
  return (
    <div>
      <Label className="text-xs">Alinhamento</Label>
      <Select
        value={value ?? defaultAlign}
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
 * Editor visual (rich text) do bloco `text` — sem exibir tags HTML pro
 * usuário. Continua salvando/recebendo HTML puro (mesmo formato que o
 * renderer de e-mail já espera via `sanitizeCustomHtml`), só a edição vira
 * WYSIWYG em vez de textarea com código.
 */
export function RichHtmlEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const lastValueRef = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
        orderedList: false,
        codeBlock: false,
        link: { openOnClick: false },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastValueRef.current = html;
      onChange(html);
    },
    editorProps: {
      attributes: {
        class:
          'max-w-none min-h-[120px] px-3 py-2 text-sm text-foreground focus:outline-none ' +
          '[&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1 ' +
          '[&_p]:mb-2 [&_p:last-child]:mb-0 ' +
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 ' +
          '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground ' +
          '[&_a]:text-primary [&_a]:underline',
      },
    },
  });

  // Bloco selecionado pode trocar sem remount do componente — sincroniza o
  // conteúdo do editor quando `value` muda por fora (ex.: trocar de bloco).
  useEffect(() => {
    if (!editor) return;
    if (value !== lastValueRef.current && value !== editor.getHTML()) {
      lastValueRef.current = value;
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const toggleLink = () => {
    const previousUrl = (editor.getAttributes('link').href as string | undefined) || '';
    const url = window.prompt('URL do link:', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div>
      <div className="flex items-center gap-1 mb-1 flex-wrap">
        <Button type="button" size="icon" variant={editor.isActive('bold') ? 'default' : 'outline'} className="h-7 w-7" title="Negrito" onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" size="icon" variant={editor.isActive('italic') ? 'default' : 'outline'} className="h-7 w-7" title="Itálico" onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" size="icon" variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'outline'} className="h-7 w-7" title="Subtítulo" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" size="icon" variant={editor.isActive('bulletList') ? 'default' : 'outline'} className="h-7 w-7" title="Lista" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" size="icon" variant={editor.isActive('blockquote') ? 'default' : 'outline'} className="h-7 w-7" title="Citação" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" size="icon" variant={editor.isActive('link') ? 'default' : 'outline'} className="h-7 w-7" title="Link" onClick={toggleLink}>
          <Link2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="rounded-md border border-input bg-background">
        <EditorContent editor={editor} />
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Editor visual — formate direto, sem digitar código. Tags de script, style, iframe e
        handlers on* são removidos automaticamente ao salvar.
      </p>
    </div>
  );
}
