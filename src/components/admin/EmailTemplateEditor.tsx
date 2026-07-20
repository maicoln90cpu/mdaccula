/**
 * Editor de blocos para templates de e-mail.
 *
 * Layout: lista drag-and-drop à esquerda, painel de propriedades à direita,
 * preview ao vivo abaixo. Usa dnd-kit (já no projeto).
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, Copy, Save, Eye, EyeOff, Library, Unlink } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import {
  type Block,
  type Template,
  BLOCK_LABELS,
  AVAILABLE_BLOCKS,
  newBlockId,
  type ArticleSummary,
  type GlobalBlock,
  TEMPLATE_PRESETS,
  buildPresetBlocks,
  type PresetKey,
} from '@/lib/emailTemplates/blocks';
import { composeEmail } from '@/lib/emailTemplates/emailComposer';
import {
  type EventAnnouncementData,
  type EmailTemplateSettings,
} from '@/lib/emailTemplates/eventAnnouncement';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEmailGlobalBlocks } from '@/hooks/useEmailGlobalBlocks';
import { GlobalBlocksLibrary } from './GlobalBlocksLibrary';
import { InboxPreviewHeader } from './InboxPreviewHeader';
import { PlaceholdersHelpDialog } from './PlaceholdersHelpDialog';

interface Props {
  templates: Template[];
  activeId: string | null;
  onActiveChange: (id: string) => void;
  onReload: () => Promise<void>;
  settings: EmailTemplateSettings;
  previewEvent: EventAnnouncementData;
  previewArticle: ArticleSummary | null;
  /** Quando não-nulo, o preview usa este HTML (ex.: digest/agenda FDS reais) em vez de calcular do mock. */
  overrideHtml?: string | null;
  onDirtyChange?: (dirty: boolean) => void;
}

const defaultForKind = (kind: Block['kind']): Block => {
  const id = newBlockId();
  switch (kind) {
    case 'header':
      return { id, kind, logo_height: 64, align: 'center', padding_y: 32 };
    case 'hero_image':
      return { id, kind, max_width: 552, border_radius: 12 };
    case 'eyebrow':
      return { id, kind, text: 'Novo evento', align: 'left' };
    case 'title':
      return { id, kind, align: 'left', font_size: 28 };
    case 'subtitle':
      return { id, kind, align: 'left' };
    case 'event_meta':
      return { id, kind, layout: 'columns' };
    case 'description':
      return { id, kind, align: 'left' };
    case 'article_summary':
      return { id, kind, show_image: true };
    case 'cta_button':
      return {
        id,
        kind,
        label: 'Garantir ingresso',
        url_field: 'ticket_link',
        align: 'center',
        full_width: true,
        bg_style: 'gradient',
      };
    case 'secondary_link':
      return { id, kind, label: 'Ver agenda completa', url_field: 'agenda_url', align: 'center' };
    case 'image_with_link':
      return {
        id,
        kind,
        image_url: '',
        link_url: '',
        alt: '',
        max_width: 552,
        align: 'center',
        border_radius: 8,
      };
    case 'divider':
      return { id, kind, thickness: 1 };
    case 'text':
      return { id, kind, html: '<p>Texto livre — suporta HTML básico.</p>', align: 'left' };
    case 'social_icons':
      return {
        id,
        kind,
        style: 'text',
        align: 'center',
        networks: [
          {
            id: 'instagram',
            label: 'Instagram',
            url: 'https://instagram.com/mdaccula',
            enabled: true,
          },
          { id: 'youtube', label: 'YouTube', url: 'https://youtube.com/@mdaccula', enabled: true },
          { id: 'tiktok', label: 'TikTok', url: 'https://tiktok.com/@mdaccula', enabled: false },
          { id: 'soundcloud', label: 'SoundCloud', url: '', enabled: false },
          { id: 'spotify', label: 'Spotify', url: '', enabled: false },
          { id: 'linktree', label: 'Linktree', url: '', enabled: false },
        ],
      };
    case 'lineup':
      return { id, kind, title: 'Line-up', layout: 'chips', align: 'center' };
    case 'countdown':
      return {
        id,
        kind,
        label: 'Lote atual encerra em',
        deadline_source: 'today_2359',
        bg_style: 'gradient',
        align: 'center',
        size: 'large',
      };
    case 'ticker':
      return {
        id,
        kind,
        messages: ['Últimas horas', 'Ingressos limitados', 'Restam poucos'],
        animation: 'fade',
        align: 'center',
        icon: 'clock',
      };
    case 'static_map':
      return {
        id,
        kind,
        zoom: 15,
        height: 300,
        map_style: 'roadmap',
        show_address_label: true,
        border_radius: 12,
      };
    case 'weekend_grid':
      return {
        id,
        kind,
        layout: 'cartaz',
        title: '',
        eyebrow: '',
        show_article_link: true,
        align: 'left',
      };
    case 'weekly_hero':
      return {
        id,
        kind,
        source: 'first_weekend',
        eyebrow: 'DESTAQUE DA SEMANA',
        cta_label: 'Garantir ingresso',
        show_venue: true,
        show_cta: true,
        overlay_intensity: 'strong',
        align: 'left',
      };
    case 'blog_posts_list':
      return {
        id,
        kind,
        title: 'Do blog nesta semana',
        eyebrow: 'MATÉRIAS',
        max_items: 3,
        layout: 'list',
        show_excerpt: true,
        show_category: true,
        align: 'left',
      };
    case 'dedge_block':
      return { id, kind, button_style: 'dark', override_content: false };
    case 'footer':
      return { id, kind, include_unsubscribe: true, align: 'center' };
    default:
      return { id, kind } as Block;
  }
};

// Controle reutilizável de alinhamento (esq/centro/dir)
function AlignControl({
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

function ColorControl({
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

function SortableRow({
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

// Fase 3 — Fluxo Editor em 2 passos:
//   1º) tipo do template (Evento / Virada / Agenda FDS / Digest / Custom)
//   2º) template daquele tipo
// Persistimos a escolha em localStorage para lembrar entre sessões.
type TypeFilterKey =
  | 'event_new'
  | 'ticket_batch'
  | 'weekend_agenda'
  | 'weekly_digest'
  | 'blog_digest'
  | 'courtesy'
  | 'custom';
const TYPE_FILTER_ORDER: TypeFilterKey[] = [
  'event_new',
  'ticket_batch',
  'weekend_agenda',
  'weekly_digest',
  'blog_digest',
  'courtesy',
  'custom',
];
const TYPE_FILTER_LABELS: Record<TypeFilterKey, string> = {
  event_new: 'Evento',
  ticket_batch: 'Virada',
  weekend_agenda: 'Agenda FDS',
  weekly_digest: 'Digest',
  blog_digest: 'Blog news',
  courtesy: 'Cortesia',
  custom: 'Custom',
};
const TYPE_FILTER_STORAGE_KEY = 'mdaccula_email_editor_type';

/** weekly_digest_editorial é uma variação de weekly_digest para o filtro. */
const normalizeType = (t: Template['type'] | undefined): TypeFilterKey => {
  if (!t) return 'custom';
  if (t === 'weekly_digest_editorial') return 'weekly_digest';
  return t as TypeFilterKey;
};

export function EmailTemplateEditor({
  templates,
  activeId,
  onActiveChange,
  onReload,
  settings,
  previewEvent,
  previewArticle,
  overrideHtml,
  onDirtyChange,
}: Props) {
  const { toast } = useToast();
  const { globalsMap, updateGlobal } = useEmailGlobalBlocks();
  const activeTpl = useMemo(
    () => templates.find((t) => t.id === activeId) || null,
    [templates, activeId]
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [localBlocks, setLocalBlocks] = useState<Block[] | null>(null);
  const [localName, setLocalName] = useState<string>('');
  const [localSubject, setLocalSubject] = useState<string | null>(null);
  const [localPreheader, setLocalPreheader] = useState<string | null>(null);

  // Tipo selecionado (passo 1). Inicializa a partir do localStorage.
  const [typeFilter, setTypeFilter] = useState<TypeFilterKey>(() => {
    if (typeof window === 'undefined') return 'event_new';
    const stored = window.localStorage.getItem(TYPE_FILTER_STORAGE_KEY);
    if (stored && (TYPE_FILTER_ORDER as string[]).includes(stored)) return stored as TypeFilterKey;
    return 'event_new';
  });

  // Contagem por tipo (para exibir nos chips).
  const countsByType = useMemo(() => {
    const counts: Record<TypeFilterKey, number> = {
      event_new: 0,
      ticket_batch: 0,
      weekend_agenda: 0,
      weekly_digest: 0,
      blog_digest: 0,
      courtesy: 0,
      custom: 0,
    };
    templates.forEach((t) => {
      counts[normalizeType(t.type)] += 1;
    });
    return counts;
  }, [templates]);

  // Templates do tipo selecionado (passo 2).
  const filteredTemplates = useMemo(
    () => templates.filter((t) => normalizeType(t.type) === typeFilter),
    [templates, typeFilter]
  );

  // Sincroniza com template ativo
  const blocks = useMemo(
    () => localBlocks ?? (activeTpl?.blocks as Block[]) ?? [],
    [localBlocks, activeTpl]
  );
  const currentName = localName || activeTpl?.name || '';
  const currentSubject = localSubject !== null ? localSubject : (activeTpl?.subject_template ?? '');
  const currentPreheader =
    localPreheader !== null ? localPreheader : (activeTpl?.preheader_template ?? '');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const oldIdx = blocks.findIndex((b) => b.id === active.id);
      const newIdx = blocks.findIndex((b) => b.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return;
      setLocalBlocks(arrayMove(blocks, oldIdx, newIdx));
    },
    [blocks]
  );

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setLocalBlocks(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  };

  /** Substitui integralmente um bloco (sem merge). Usado para "desfazer vínculo" de global_ref. */
  const replaceBlock = (id: string, next: Block) => {
    setLocalBlocks(blocks.map((b) => (b.id === id ? next : b)));
  };

  const addBlock = (kind: Block['kind']) => {
    setLocalBlocks([...blocks, defaultForKind(kind)]);
  };

  const removeBlock = (id: string) => {
    setLocalBlocks(blocks.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const duplicateBlock = (id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const clone = { ...blocks[idx], id: newBlockId() };
    const next = [...blocks];
    next.splice(idx + 1, 0, clone);
    setLocalBlocks(next);
  };

  const saveTemplate = async () => {
    if (!activeTpl?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({
          blocks,
          name: currentName,
          subject_template: currentSubject || null,
          preheader_template: currentPreheader || null,
        })
        .eq('id', activeTpl.id);
      if (error) throw error;
      toast({ title: 'Template salvo' });
      setLocalBlocks(null);
      setLocalName('');
      setLocalSubject(null);
      setLocalPreheader(null);
      await onReload();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: message });
    } finally {
      setSaving(false);
    }
  };

  const createTemplate = async (presetKey?: PresetKey) => {
    try {
      const preset = presetKey ? TEMPLATE_PRESETS.find((p) => p.key === presetKey) : null;
      const defaultName = preset ? preset.name : 'Novo template';
      const name = prompt('Nome do novo template:', defaultName);
      if (!name) return;
      const blocks = preset
        ? buildPresetBlocks(preset.key)
        : [
            defaultForKind('header'),
            defaultForKind('hero_image'),
            defaultForKind('title'),
            defaultForKind('cta_button'),
            defaultForKind('footer'),
          ];
      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          name,
          type: preset ? preset.template_type : 'custom',
          blocks,
          subject_template: preset?.subject_template ?? null,
          preheader_template: preset?.preheader_template ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await onReload();
      onActiveChange(data.id);
      toast({
        title: preset ? `Template criado a partir do preset "${preset.name}"` : 'Template criado',
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro', description: message });
    }
  };

  const duplicateTemplate = async () => {
    if (!activeTpl) return;
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          name: `${activeTpl.name} (cópia)`,
          type: 'custom',
          blocks: activeTpl.blocks,
          subject_template: activeTpl.subject_template,
          preheader_template: activeTpl.preheader_template,
        })
        .select()
        .single();
      if (error) throw error;
      await onReload();
      onActiveChange(data.id);
      toast({ title: 'Template duplicado' });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro', description: message });
    }
  };

  const deleteTemplate = async () => {
    if (!activeTpl?.id || activeTpl.is_default) return;
    if (!confirm(`Excluir "${activeTpl.name}"? Não é possível desfazer.`)) return;
    try {
      const { error } = await supabase.from('email_templates').delete().eq('id', activeTpl.id);
      if (error) throw error;
      await onReload();
      toast({ title: 'Template excluído' });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro', description: message });
    }
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;

  const previewComposition = useMemo(
    () =>
      composeEmail({
        template: {
          blocks,
          subject_template: currentSubject,
          preheader_template: currentPreheader,
        },
        event: previewEvent,
        settings,
        article: previewArticle,
        globals: globalsMap,
      }),
    [blocks, currentSubject, currentPreheader, previewEvent, settings, previewArticle, globalsMap]
  );

  // ============================================================
  // Detecção de "alterações não salvas" (item 7 do plano)
  // ------------------------------------------------------------
  // Antes: o editor mantinha localBlocks até "Salvar"; se você trocasse
  // de template ou fechasse a aba, as mudanças sumiam sem aviso.
  // Agora: badge visível + confirmação ao trocar + beforeunload.
  // ============================================================
  const isDirty =
    localBlocks !== null ||
    (localName !== '' && localName !== activeTpl?.name) ||
    (localSubject !== null && localSubject !== (activeTpl?.subject_template ?? '')) ||
    (localPreheader !== null && localPreheader !== (activeTpl?.preheader_template ?? ''));

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleActiveChange = (nextId: string) => {
    if (
      isDirty &&
      !confirm(
        'Há alterações não salvas neste template. Trocar mesmo assim? As alterações serão perdidas.'
      )
    ) {
      return;
    }
    setLocalBlocks(null);
    setLocalName('');
    setLocalSubject(null);
    setLocalPreheader(null);
    setSelectedBlockId(null);
    onActiveChange(nextId);
  };

  // Troca do tipo (passo 1). Se houver alterações não salvas, confirma antes.
  const handleTypeFilterChange = (nextType: TypeFilterKey) => {
    if (nextType === typeFilter) return;
    if (
      isDirty &&
      !confirm(
        'Há alterações não salvas neste template. Trocar de tipo mesmo assim? As alterações serão perdidas.'
      )
    ) {
      return;
    }
    setLocalBlocks(null);
    setLocalName('');
    setLocalSubject(null);
    setLocalPreheader(null);
    setSelectedBlockId(null);
    setTypeFilter(nextType);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TYPE_FILTER_STORAGE_KEY, nextType);
    }
    const firstOfType = templates.find((t) => normalizeType(t.type) === nextType);
    onActiveChange(firstOfType?.id ?? '');
  };

  // Se o template ativo mudou para outro tipo (ex.: vindo do histórico),
  // ajusta o filtro para bater com ele.
  useEffect(() => {
    if (!activeTpl) return;
    const activeType = normalizeType(activeTpl.type);
    if (activeType !== typeFilter) {
      setTypeFilter(activeType);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TYPE_FILTER_STORAGE_KEY, activeType);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTpl?.id]);

  return (
    <div className="space-y-4">
      {/* Passo 1 — escolher o TIPO do template */}
      <div>
        <Label className="text-xs mb-1.5 block">1º Tipo de template</Label>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTER_ORDER.map((key) => {
            const active = typeFilter === key;
            const count = countsByType[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleTypeFilterChange(key)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground/80 border-border hover:border-primary/50'
                }`}
              >
                {TYPE_FILTER_LABELS[key]}{' '}
                <span className={active ? 'opacity-80' : 'text-muted-foreground'}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Passo 2 — escolher o template daquele tipo + ações */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[240px]">
          <Label className="text-xs flex items-center gap-2">
            2º Template de {TYPE_FILTER_LABELS[typeFilter]}
            {isDirty && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                • não salvo
              </span>
            )}
          </Label>
          {filteredTemplates.length === 0 ? (
            <div className="text-xs text-muted-foreground border border-dashed border-border rounded px-3 py-2">
              Nenhum template de "{TYPE_FILTER_LABELS[typeFilter]}" ainda. Use "Novo" para criar.
            </div>
          ) : (
            <Select value={activeId || ''} onValueChange={handleActiveChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {filteredTemplates.map((t) => (
                  <SelectItem key={t.id!} value={t.id!}>
                    {t.name} {t.is_default && '· padrão'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Novo
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Criar a partir de preset</DropdownMenuLabel>
            {TEMPLATE_PRESETS.map((p) => (
              <DropdownMenuItem
                key={p.key}
                onClick={() => createTemplate(p.key)}
                className="flex-col items-start gap-0.5"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-[11px] text-muted-foreground whitespace-normal">
                  {p.description}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => createTemplate()}>Em branco</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="outline" onClick={duplicateTemplate} disabled={!activeTpl}>
          <Copy className="w-4 h-4 mr-1" />
          Duplicar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={deleteTemplate}
          disabled={!activeTpl || activeTpl.is_default}
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Excluir
        </Button>
        <Button
          size="sm"
          variant={isDirty ? 'default' : 'outline'}
          onClick={saveTemplate}
          disabled={!activeTpl || saving || !isDirty}
          className={isDirty ? 'ring-2 ring-amber-500/40' : ''}
        >
          <Save className="w-4 h-4 mr-1" />
          {saving ? 'Salvando…' : isDirty ? 'Salvar alterações' : 'Salvo'}
        </Button>
      </div>

      {activeTpl && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome do template</Label>
            <Input
              value={currentName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="Nome do template"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Assunto do e-mail</Label>
                <PlaceholdersHelpDialog />
              </div>
              <Input
                value={currentSubject}
                onChange={(e) => setLocalSubject(e.target.value)}
                placeholder="Ex.: Novo evento: {{event_title}}"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Aceita <code>{'{{event_title}}'}</code>, <code>{'{{date_label}}'}</code>,{' '}
                <code>{'{{venue_name}}'}</code>, <code>{'{{city_state}}'}</code>,{' '}
                <code>{'{{weekend_range}}'}</code> e mais — clique em <b>Ver placeholders</b>.
              </p>
            </div>
            <div>
              <Label className="text-xs">Preheader (preview na caixa de entrada)</Label>
              <Input
                value={currentPreheader}
                onChange={(e) => setLocalPreheader(e.target.value)}
                placeholder="Ex.: {{event_title}} em {{venue_name}} — ingressos abertos"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Texto curto exibido ao lado do assunto. Aceita os mesmos placeholders.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr_1fr]">
        {/* Lista de blocos */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Blocos do e-mail
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1.5">
                  {blocks.map((b) => {
                    const isGlobal = b.kind === 'global_ref';
                    const resolvedName =
                      b.kind === 'global_ref'
                        ? (globalsMap.get(b.global_id)?.name ?? b._cached_name ?? 'Bloco global')
                        : BLOCK_LABELS[b.kind];
                    return (
                      <SortableRow
                        key={b.id}
                        block={b}
                        active={selectedBlockId === b.id}
                        label={resolvedName}
                        isGlobal={isGlobal}
                        onSelect={() => setSelectedBlockId(b.id)}
                        onRemove={() => removeBlock(b.id)}
                        onDuplicate={() => duplicateBlock(b.id)}
                        onToggleHidden={() =>
                          updateBlock(b.id, {
                            hidden: !(b as { hidden?: boolean }).hidden,
                          } as unknown as Partial<Block>)
                        }
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>

            <div className="pt-3 border-t mt-3">
              <Label className="text-xs mb-1 block">Adicionar bloco</Label>
              <Select onValueChange={(v) => addBlock(v as Block['kind'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolher tipo" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_BLOCKS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {BLOCK_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Biblioteca de blocos globais - Fase C */}
            <div className="pt-3 border-t mt-3">
              <GlobalBlocksLibrary
                selectedBlock={selectedBlock}
                onInsert={(b) => setLocalBlocks([...(blocks as Block[]), b])}
              />
            </div>
          </CardContent>
        </Card>

        {/* Painel de propriedades */}
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Propriedades
            </div>
            {!selectedBlock && (
              <p className="text-sm text-muted-foreground">
                Clique num bloco à esquerda para editar suas propriedades.
              </p>
            )}
            {selectedBlock && selectedBlock.kind === 'global_ref' && (
              <GlobalRefPropsPanel
                refBlock={selectedBlock as Extract<Block, { kind: 'global_ref' }>}
                templates={templates}
                globalsMap={globalsMap}
                updateGlobal={updateGlobal}
                onUnlink={(expanded) => {
                  const localCopy: Block = { ...expanded, id: selectedBlock.id } as Block;
                  replaceBlock(selectedBlock.id, localCopy);
                  toast({
                    title: 'Vínculo desfeito',
                    description:
                      'O bloco virou local neste template. Edições agora só afetam este template.',
                  });
                }}
                onToast={(t) => toast(t)}
              />
            )}
            {selectedBlock && selectedBlock.kind !== 'global_ref' && (
              <BlockPropsPanel
                block={selectedBlock}
                onChange={(patch) => updateBlock(selectedBlock.id, patch)}
              />
            )}
          </CardContent>
        </Card>

        {/* Preview — A2 fix: iframe fixado em 600px (largura real do e-mail).
            Container com scroll horizontal em telas estreitas, para que o logo
            e todas as imagens apareçam no mesmo tamanho que o cliente receberá.

            Fallback local: quando o override (HTML da edge function) existe mas
            o template tem alterações não salvas, o HTML do servidor está
            desatualizado — mostramos o render local + banner alertando. */}
        <Card>
          <CardContent className="p-2">
            <div className="flex items-center justify-between mb-2 px-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {overrideHtml && !isDirty
                  ? 'Preview real (dados do disparo)'
                  : 'Preview ao vivo (600px reais)'}
              </div>
              <div className="text-[10px] text-muted-foreground">
                ≈ largura real na caixa de entrada
              </div>
            </div>
            {overrideHtml && isDirty && (
              <div className="mx-1 mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                ⚠ Alterações não salvas — o preview real usa o template já salvo. Mostrando{' '}
                <b>render local</b> com os blocos atuais. Salve para atualizar o preview real.
              </div>
            )}
            {previewComposition.issues.length > 0 && (
              <div className="mx-1 mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-700 dark:text-red-300">
                <div className="font-semibold">Este modelo ainda não pode ser enviado:</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {previewComposition.issues.map((item) => (
                    <li key={`${item.blockId}-${item.code}`}>{item.message}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="px-1">
              <InboxPreviewHeader
                subjectTemplate={currentSubject}
                preheaderTemplate={currentPreheader}
                data={{
                  eventTitle: previewEvent.eventTitle,
                  dateLabel: previewEvent.dateLabel,
                  timeLabel: previewEvent.timeLabel,
                  venueName: previewEvent.venueName,
                  cityState: previewEvent.cityState,
                }}
              />
            </div>
            <div className="overflow-x-auto rounded border bg-[#050505] p-2">
              <iframe
                title="preview"
                srcDoc={overrideHtml && !isDirty ? overrideHtml : previewComposition.html}
                width={600}
                className="block mx-auto h-[900px] bg-white"
                style={{ width: 600, minWidth: 600, border: 0 }}
                sandbox=""
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// Painel de propriedades por tipo de bloco
// ============================================

function BlockPropsPanel({
  block,
  onChange,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
}) {
  const patch = (p: Record<string, unknown>) => onChange(p as Partial<Block>);

  switch (block.kind) {
    case 'header':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Altura do logo: {block.logo_height ?? 64}px</Label>
            <Slider
              min={32}
              max={120}
              step={4}
              value={[block.logo_height ?? 64]}
              onValueChange={(v) => patch({ logo_height: v[0] })}
            />
          </div>
          <div>
            <Label className="text-xs">Espaçamento superior: {block.padding_y ?? 32}px</Label>
            <Slider
              min={0}
              max={80}
              step={4}
              value={[block.padding_y ?? 32]}
              onValueChange={(v) => patch({ padding_y: v[0] })}
            />
          </div>
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
          <p className="text-xs text-muted-foreground">
            O logo em si é definido na aba "Template (marca)".
          </p>
        </div>
      );

    case 'hero_image':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Largura máxima: {block.max_width ?? 552}px</Label>
            <Slider
              min={300}
              max={600}
              step={20}
              value={[block.max_width ?? 552]}
              onValueChange={(v) => patch({ max_width: v[0] })}
            />
          </div>
          <div>
            <Label className="text-xs">Borda arredondada: {block.border_radius ?? 12}px</Label>
            <Slider
              min={0}
              max={24}
              step={2}
              value={[block.border_radius ?? 12]}
              onValueChange={(v) => patch({ border_radius: v[0] })}
            />
          </div>
          <p className="text-xs text-muted-foreground">A imagem vem do flyer do evento.</p>
        </div>
      );

    case 'eyebrow':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Texto</Label>
            <Input value={block.text || ''} onChange={(e) => patch({ text: e.target.value })} />
          </div>
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
          <ColorControl
            label="Cor do texto (deixe vazio para usar a cor primária)"
            value={block.text_color}
            onChange={(v) => patch({ text_color: v })}
            placeholder="#a855f7"
          />
        </div>
      );

    case 'title':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Tamanho da fonte: {block.font_size ?? 28}px</Label>
            <Slider
              min={18}
              max={48}
              step={2}
              value={[block.font_size ?? 28]}
              onValueChange={(v) => patch({ font_size: v[0] })}
            />
          </div>
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
          <ColorControl
            label="Cor do texto"
            value={block.text_color}
            onChange={(v) => patch({ text_color: v })}
            placeholder="#ffffff"
          />
          <p className="text-xs text-muted-foreground">O texto vem do título do evento.</p>
        </div>
      );

    case 'subtitle':
      return (
        <div className="space-y-3">
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
          <ColorControl
            label="Cor do texto"
            value={block.text_color}
            onChange={(v) => patch({ text_color: v })}
            placeholder="#a1a1aa"
          />
          <p className="text-xs text-muted-foreground">
            O texto vem do subtítulo do evento (some se vazio).
          </p>
        </div>
      );

    case 'event_meta':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Layout</Label>
            <Select value={block.layout || 'columns'} onValueChange={(v) => patch({ layout: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="columns">Duas colunas (data | local)</SelectItem>
                <SelectItem value="stacked">Empilhado (melhor no mobile)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case 'description':
      return (
        <div className="space-y-3">
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
          <ColorControl
            label="Cor do texto"
            value={block.text_color}
            onChange={(v) => patch({ text_color: v })}
            placeholder="#a1a1aa"
          />
        </div>
      );

    case 'article_summary':
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={block.show_image !== false}
              onCheckedChange={(v) => patch({ show_image: v })}
            />
            <Label className="text-xs">Mostrar imagem da matéria</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Bloco só aparece quando o evento tem matéria vinculada.
          </p>
        </div>
      );

    case 'cta_button':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Texto do botão</Label>
            <Input value={block.label || ''} onChange={(e) => patch({ label: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Link do botão</Label>
            <Select
              value={block.url_field || 'ticket_link'}
              onValueChange={(v) => patch({ url_field: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ticket_link">Link de ingresso do evento</SelectItem>
                <SelectItem value="vip_link">Link Camarote do evento</SelectItem>
                <SelectItem value="event_url">Página do evento no site</SelectItem>
                <SelectItem value="custom">URL personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {block.url_field === 'custom' && (
            <div>
              <Label className="text-xs">URL personalizada</Label>
              <Input
                value={block.custom_url || ''}
                onChange={(e) => patch({ custom_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch
              checked={block.full_width !== false}
              onCheckedChange={(v) => patch({ full_width: v })}
            />
            <Label className="text-xs">Ocupar toda a largura</Label>
          </div>
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
          <div>
            <Label className="text-xs">Cor de fundo</Label>
            <Select
              value={block.bg_style || 'gradient'}
              onValueChange={(v) => patch({ bg_style: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gradient">Gradiente da marca (padrão)</SelectItem>
                <SelectItem value="solid">Cor sólida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {block.bg_style === 'solid' && (
            <ColorControl
              label="Cor sólida do botão"
              value={block.bg_color}
              onChange={(v) => patch({ bg_color: v })}
              placeholder="#a855f7"
            />
          )}
        </div>
      );

    case 'secondary_link':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Texto</Label>
            <Input value={block.label || ''} onChange={(e) => patch({ label: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Link</Label>
            <Select
              value={block.url_field || 'agenda_url'}
              onValueChange={(v) => patch({ url_field: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agenda_url">Agenda completa</SelectItem>
                <SelectItem value="event_url">Página do evento</SelectItem>
                <SelectItem value="custom">URL personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {block.url_field === 'custom' && (
            <Input
              value={block.custom_url || ''}
              onChange={(e) => patch({ custom_url: e.target.value })}
              placeholder="https://…"
            />
          )}
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        </div>
      );

    case 'image_with_link':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">URL da imagem</Label>
            <Input
              value={block.image_url}
              onChange={(e) => patch({ image_url: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <div>
            <Label className="text-xs">Link ao clicar</Label>
            <Input
              value={block.link_url}
              onChange={(e) => patch({ link_url: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <div>
            <Label className="text-xs">Texto alternativo (alt)</Label>
            <Input value={block.alt || ''} onChange={(e) => patch({ alt: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">
              Largura máxima: {block.max_width ?? 552}px (máx. 552 = largura útil do e-mail)
            </Label>
            <Slider
              min={200}
              max={552}
              step={8}
              value={[block.max_width ?? 552]}
              onValueChange={(v) => patch({ max_width: v[0] })}
            />
          </div>
          <div>
            <Label className="text-xs">Borda arredondada: {block.border_radius ?? 8}px</Label>
            <Slider
              min={0}
              max={24}
              step={2}
              value={[block.border_radius ?? 8]}
              onValueChange={(v) => patch({ border_radius: v[0] })}
            />
          </div>
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        </div>
      );

    case 'divider':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Espessura: {block.thickness ?? 1}px</Label>
            <Slider
              min={1}
              max={8}
              step={1}
              value={[block.thickness ?? 1]}
              onValueChange={(v) => patch({ thickness: v[0] })}
            />
          </div>
          <ColorControl
            label="Cor"
            value={block.color}
            onChange={(v) => patch({ color: v })}
            placeholder="rgba(255,255,255,0.08)"
          />
        </div>
      );

    case 'text':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">HTML (tags básicas)</Label>
            <Textarea
              rows={6}
              value={block.html || ''}
              onChange={(e) => patch({ html: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tags de script, style, iframe e handlers on* são removidos.
            </p>
          </div>
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
          <ColorControl
            label="Cor base do texto"
            value={block.text_color}
            onChange={(v) => patch({ text_color: v })}
            placeholder="#a1a1aa"
          />
        </div>
      );

    case 'social_icons':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Estilo</Label>
            <Select value={block.style || 'text'} onValueChange={(v) => patch({ style: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto colorido (padrão)</SelectItem>
                <SelectItem value="pill">Pílulas coloridas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
          <p className="text-xs text-muted-foreground">
            Ative e informe a URL de cada rede. Somente as ativadas com URL aparecem no e-mail.
          </p>
          {(block.networks || []).map((n, i) => (
            <div key={n.id} className="flex items-center gap-2 p-2 rounded border">
              <Switch
                checked={n.enabled}
                onCheckedChange={(v) => {
                  const next = [...(block.networks || [])];
                  next[i] = { ...n, enabled: v };
                  patch({ networks: next });
                }}
              />
              <div className="flex-1">
                <div className="text-xs font-medium">{n.label}</div>
                <Input
                  className="h-7 text-xs mt-1"
                  value={n.url}
                  placeholder="https://…"
                  onChange={(e) => {
                    const next = [...(block.networks || [])];
                    next[i] = { ...n, url: e.target.value };
                    patch({ networks: next });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      );

    case 'lineup':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Título da seção</Label>
            <Input
              value={block.title || ''}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Line-up"
            />
          </div>
          <div>
            <Label className="text-xs">Layout</Label>
            <Select value={block.layout || 'chips'} onValueChange={(v) => patch({ layout: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chips">Pílulas (compacto)</SelectItem>
                <SelectItem value="list">Lista (um por linha)</SelectItem>
                <SelectItem value="grid">Grade (2 colunas)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
          <ColorControl
            label="Cor do título"
            value={block.title_color}
            onChange={(v) => patch({ title_color: v })}
            placeholder="#a855f7"
          />
          <ColorControl
            label="Cor dos nomes"
            value={block.text_color}
            onChange={(v) => patch({ text_color: v })}
            placeholder="#ffffff"
          />
          <p className="text-xs text-muted-foreground">
            Os artistas vêm do campo "Line-up" do evento. Se estiver vazio, o bloco some.
          </p>
        </div>
      );

    case 'countdown':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Texto acima do contador</Label>
            <Input
              value={block.label || ''}
              onChange={(e) => patch({ label: e.target.value })}
              placeholder="Lote atual encerra em"
            />
          </div>
          <div>
            <Label className="text-xs">Data-limite</Label>
            <Select
              value={block.deadline_source || 'today_2359'}
              onValueChange={(v) => patch({ deadline_source: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today_2359">Hoje às 23:59 (padrão virada de lote)</SelectItem>
                <SelectItem value="batch_deadline">
                  Data da virada do evento (se cadastrada)
                </SelectItem>
                <SelectItem value="event_start">Início do evento</SelectItem>
                <SelectItem value="custom">Data/hora personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {block.deadline_source === 'custom' && (
            <div>
              <Label className="text-xs">Data/hora personalizada</Label>
              <Input
                type="datetime-local"
                value={block.custom_deadline ? block.custom_deadline.slice(0, 16) : ''}
                onChange={(e) =>
                  patch({
                    custom_deadline: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : undefined,
                  })
                }
              />
            </div>
          )}
          <div>
            <Label className="text-xs">Tamanho</Label>
            <Select value={block.size || 'large'} onValueChange={(v) => patch({ size: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="large">Grande — 3 caixas (dias/horas/min)</SelectItem>
                <SelectItem value="medium">Médio — 2 caixas (horas/minutos)</SelectItem>
                <SelectItem value="minimal">Minimalista — 1 linha compacta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Estilo de fundo</Label>
            <Select
              value={block.bg_style || 'gradient'}
              onValueChange={(v) => patch({ bg_style: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gradient">Gradiente da marca</SelectItem>
                <SelectItem value="solid">Cor sólida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {block.bg_style === 'solid' && (
            <ColorControl
              label="Cor de fundo"
              value={block.bg_color}
              onChange={(v) => patch({ bg_color: v })}
              placeholder="#a855f7"
            />
          )}
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
          <p className="text-xs text-muted-foreground">
            E-mail não roda JavaScript — o contador é <strong>congelado no momento do envio</strong>{' '}
            (dias/horas/minutos restantes).
          </p>
        </div>
      );

    case 'ticker': {
      const msgs = block.messages || ['Últimas horas', 'Ingressos limitados', 'Restam poucos'];
      const setMsg = (i: number, v: string) => {
        const next = [...msgs];
        next[i] = v;
        patch({ messages: next.filter((x) => x !== '').slice(0, 3) });
      };
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Barra fina com mensagens curtas de urgência. Suporta até 3 frases. Animação funciona em
            Apple Mail/iOS; Gmail/Outlook mostram a 1ª mensagem estática (fallback automático).
          </p>
          <div>
            <Label className="text-xs">Mensagem 1</Label>
            <Input
              value={msgs[0] || ''}
              onChange={(e) => setMsg(0, e.target.value)}
              placeholder="Últimas horas"
            />
          </div>
          <div>
            <Label className="text-xs">Mensagem 2 (opcional)</Label>
            <Input
              value={msgs[1] || ''}
              onChange={(e) => setMsg(1, e.target.value)}
              placeholder="Ingressos limitados"
            />
          </div>
          <div>
            <Label className="text-xs">Mensagem 3 (opcional)</Label>
            <Input
              value={msgs[2] || ''}
              onChange={(e) => setMsg(2, e.target.value)}
              placeholder="Restam poucos"
            />
          </div>
          <div>
            <Label className="text-xs">Ícone</Label>
            <Select value={block.icon || 'clock'} onValueChange={(v) => patch({ icon: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                <SelectItem value="clock">⏰ Relógio</SelectItem>
                <SelectItem value="fire">🔥 Fogo</SelectItem>
                <SelectItem value="bolt">⚡ Raio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Animação</Label>
            <Select
              value={block.animation || 'fade'}
              onValueChange={(v) => patch({ animation: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fade">Alternar mensagens (fade)</SelectItem>
                <SelectItem value="slide">Deslizar (marquee)</SelectItem>
                <SelectItem value="none">Sem animação (estática)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ColorControl
            label="Cor de fundo"
            value={block.bg_color}
            onChange={(v) => patch({ bg_color: v })}
            placeholder="Cor primária"
          />
          <ColorControl
            label="Cor do texto"
            value={block.text_color}
            onChange={(v) => patch({ text_color: v })}
            placeholder="#ffffff"
          />
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        </div>
      );
    }

    case 'static_map':
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Mini-mapa do venue, clicável — abre no Waze/Google Maps do celular. Só aparece se o
            evento tiver <strong>coordenadas (latitude/longitude)</strong> preenchidas. Você
            configura isso no formulário do evento.
          </p>
          <div>
            <Label className="text-xs">Zoom ({block.zoom ?? 15})</Label>
            <input
              type="range"
              min={12}
              max={18}
              value={block.zoom ?? 15}
              onChange={(e) => patch({ zoom: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <Label className="text-xs">Altura</Label>
            <Select
              value={String(block.height ?? 300)}
              onValueChange={(v) => patch({ height: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="200">Baixa (200px)</SelectItem>
                <SelectItem value="300">Média (300px)</SelectItem>
                <SelectItem value="400">Alta (400px)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Estilo do mapa</Label>
            <Select
              value={block.map_style || 'roadmap'}
              onValueChange={(v) => patch({ map_style: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="roadmap">Ruas (padrão)</SelectItem>
                <SelectItem value="terrain">Terreno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Bordas arredondadas</Label>
            <Select
              value={String(block.border_radius ?? 12)}
              onValueChange={(v) => patch({ border_radius: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sem borda</SelectItem>
                <SelectItem value="8">8px</SelectItem>
                <SelectItem value="12">12px</SelectItem>
                <SelectItem value="16">16px</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={block.show_address_label !== false}
              onCheckedChange={(v) => patch({ show_address_label: v })}
            />
            <Label className="text-xs">Mostrar nome do venue e cidade abaixo do mapa</Label>
          </div>
        </div>
      );

    case 'weekend_grid':
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Grade de eventos do fim de semana. Os eventos são coletados automaticamente pelo disparo
            semanal (sex/sáb/dom da semana em curso).
          </p>
          <div>
            <Label className="text-xs">Layout</Label>
            <Select value={block.layout || 'cartaz'} onValueChange={(v) => patch({ layout: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cartaz">
                  Cartaz digital (recomendado — cards full-width)
                </SelectItem>
                <SelectItem value="timeline">
                  Timeline por dia (compacto, barra colorida)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Etiqueta (topo — opcional)</Label>
            <Input
              value={block.eyebrow || ''}
              onChange={(e) => patch({ eyebrow: e.target.value })}
              placeholder="AGENDA · FIM DE SEMANA"
            />
          </div>
          <div>
            <Label className="text-xs">Título (opcional)</Label>
            <Input
              value={block.title || ''}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="O que rola no fds"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={block.show_article_link !== false}
              onCheckedChange={(v) => patch({ show_article_link: v })}
            />
            <Label className="text-xs">
              Mostrar link "Ler matéria" quando o evento tiver artigo
            </Label>
          </div>
          {block.layout === 'timeline' && (
            <ColorControl
              label="Cor da barra do dia"
              value={block.day_bar_color}
              onChange={(v) => patch({ day_bar_color: v })}
              placeholder="Cor de destaque"
            />
          )}
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        </div>
      );

    case 'weekly_hero':
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Destaque grande no topo do e-mail. Usa o 1º evento do array <code>weekendEvents</code>{' '}
            ou os dados do evento principal (mock/real).
          </p>
          <div>
            <Label className="text-xs">Fonte dos dados</Label>
            <Select
              value={block.source || 'first_weekend'}
              onValueChange={(v) => patch({ source: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first_weekend">
                  1º evento de weekendEvents (recomendado para digest)
                </SelectItem>
                <SelectItem value="main_event">
                  Evento principal (mock/real selecionado no preview)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Etiqueta (topo)</Label>
            <Input
              value={block.eyebrow || ''}
              onChange={(e) => patch({ eyebrow: e.target.value })}
              placeholder="DESTAQUE DA SEMANA"
            />
          </div>
          <div>
            <Label className="text-xs">Texto do CTA</Label>
            <Input
              value={block.cta_label || ''}
              onChange={(e) => patch({ cta_label: e.target.value })}
              placeholder="Garantir ingresso"
            />
          </div>
          <div>
            <Label className="text-xs">Intensidade do overlay sobre o flyer</Label>
            <Select
              value={block.overlay_intensity || 'strong'}
              onValueChange={(v) => patch({ overlay_intensity: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strong">
                  Forte (recomendado — textos legíveis sobre qualquer flyer)
                </SelectItem>
                <SelectItem value="soft">Suave (flyer mais visível)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={block.show_venue !== false}
              onCheckedChange={(v) => patch({ show_venue: v })}
            />
            <Label className="text-xs">Mostrar local (venue + cidade)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={block.show_cta !== false}
              onCheckedChange={(v) => patch({ show_cta: v })}
            />
            <Label className="text-xs">Mostrar botão CTA</Label>
          </div>
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        </div>
      );

    case 'blog_posts_list':
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Lista dos últimos posts do blog. Os posts são coletados automaticamente pelo disparo
            semanal (últimos publicados).
          </p>
          <div>
            <Label className="text-xs">Etiqueta (topo)</Label>
            <Input
              value={block.eyebrow || ''}
              onChange={(e) => patch({ eyebrow: e.target.value })}
              placeholder="MATÉRIAS"
            />
          </div>
          <div>
            <Label className="text-xs">Título</Label>
            <Input
              value={block.title || ''}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Do blog nesta semana"
            />
          </div>
          <div>
            <Label className="text-xs">Layout</Label>
            <Select value={block.layout || 'list'} onValueChange={(v) => patch({ layout: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">Lista compacta (miniatura + texto)</SelectItem>
                <SelectItem value="cards">Cards com imagem grande</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Máximo de posts</Label>
            <Select
              value={String(block.max_items ?? 3)}
              onValueChange={(v) => patch({ max_items: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={block.show_excerpt !== false}
              onCheckedChange={(v) => patch({ show_excerpt: v })}
            />
            <Label className="text-xs">Mostrar resumo (excerpt)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={block.show_category !== false}
              onCheckedChange={(v) => patch({ show_category: v })}
            />
            <Label className="text-xs">Mostrar categoria + data</Label>
          </div>
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
        </div>
      );

    case 'dedge_block':
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Bloco fixo da residência Dedge (encerramento da newsletter do FDS). Por padrão usa a
            imagem/textos/noites configurados no disparo — marque "Personalizar" para sobrescrever
            aqui.
          </p>
          <div>
            <Label className="text-xs">Estilo dos botões das noites</Label>
            <Select
              value={block.button_style || 'dark'}
              onValueChange={(v) => patch({ button_style: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">
                  Preto minimalista (padrão — combina com layout cartaz)
                </SelectItem>
                <SelectItem value="primary">
                  Gradiente da marca (combina com layout timeline)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={block.override_content === true}
              onCheckedChange={(v) => patch({ override_content: v })}
            />
            <Label className="text-xs">Personalizar imagem e textos (sobrescreve o payload)</Label>
          </div>
          {block.override_content && (
            <>
              <div>
                <Label className="text-xs">URL da imagem Dedge</Label>
                <Input
                  value={block.image_url || ''}
                  onChange={(e) => patch({ image_url: e.target.value })}
                  placeholder="https://mdaccula.b-cdn.net/…"
                />
              </div>
              <div>
                <Label className="text-xs">Etiqueta</Label>
                <Input
                  value={block.eyebrow || ''}
                  onChange={(e) => patch({ eyebrow: e.target.value })}
                  placeholder="TODA SEMANA · RESIDÊNCIA"
                />
              </div>
              <div>
                <Label className="text-xs">Título</Label>
                <Input
                  value={block.title || ''}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="Dedge — sua residência da semana"
                />
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Textarea
                  rows={2}
                  value={block.description || ''}
                  onChange={(e) => patch({ description: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Texto do botão principal</Label>
                <Input
                  value={block.primary_label || ''}
                  onChange={(e) => patch({ primary_label: e.target.value })}
                  placeholder="Ver todos os eventos Dedge"
                />
              </div>
              <div>
                <Label className="text-xs">URL do botão principal</Label>
                <Input
                  value={block.primary_url || ''}
                  onChange={(e) => patch({ primary_url: e.target.value })}
                  placeholder="https://mdaccula.com/…"
                />
              </div>
            </>
          )}
        </div>
      );

    case 'footer':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Texto do rodapé (opcional — usa o padrão se vazio)</Label>
            <Textarea
              rows={3}
              value={block.text || ''}
              onChange={(e) => patch({ text: e.target.value })}
            />
          </div>
          <AlignControl value={block.align} onChange={(v) => patch({ align: v })} />
          <div className="flex items-center gap-2">
            <Switch
              checked={block.include_unsubscribe !== false}
              onCheckedChange={(v) => patch({ include_unsubscribe: v })}
            />
            <Label className="text-xs">Incluir botão "Descadastrar-se" (oficial E-goi)</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            O link usa o placeholder{' '}
            <code className="bg-muted px-1 rounded">[E-GOI_UNSUBSCRIBE_LINK]</code>, substituído
            pela E-goi no momento do envio.
          </p>
        </div>
      );

    default:
      return (
        <p className="text-sm text-muted-foreground">
          Este bloco não tem propriedades editáveis — sua aparência vem dos dados do evento.
        </p>
      );
  }
}

// ============================================
// Painel para bloco global_ref
// --------------------------------------------
// Mostra info do global + reaproveita BlockPropsPanel para editar o CONTEÚDO
// interno. Salvar propaga para todos os templates que referenciam este global.
// Também oferece "Desfazer vínculo" para converter em bloco local.
// ============================================
function GlobalRefPropsPanel({
  refBlock,
  templates,
  globalsMap,
  updateGlobal,
  onUnlink,
  onToast,
}: {
  refBlock: Extract<Block, { kind: 'global_ref' }>;
  templates: Template[];
  globalsMap: Map<string, GlobalBlock>;
  updateGlobal: (id: string, patch: Partial<Omit<GlobalBlock, 'id'>>) => Promise<void>;
  onUnlink: (expanded: Block) => void;
  onToast: (t: {
    title: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }) => void;
}) {
  const global = globalsMap.get(refBlock.global_id) || null;
  const [saving, setSaving] = useState(false);

  const usageCount = useMemo(() => {
    let n = 0;
    for (const t of templates) {
      for (const b of t.blocks as Block[]) {
        if (b.kind === 'global_ref' && b.global_id === refBlock.global_id) {
          n++;
          break;
        }
      }
    }
    return n;
  }, [templates, refBlock.global_id]);

  if (!global) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Library className="w-4 h-4 text-destructive" />
          <span className="font-medium">Bloco global indisponível</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Este bloco global foi excluído da biblioteca. Referência:{' '}
          <code className="text-[10px]">{refBlock.global_id}</code>.
          {refBlock._cached_name && (
            <>
              {' '}
              Última cópia conhecida: <strong>{refBlock._cached_name}</strong>.
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          Remova este bloco do template ou recrie o global com o mesmo nome.
        </p>
      </div>
    );
  }

  const handleInnerChange = async (patch: Partial<Block>) => {
    const nextInner = { ...global.block, ...patch } as Block;
    setSaving(true);
    try {
      await updateGlobal(global.id, { block: nextInner });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      onToast({
        variant: 'destructive',
        title: 'Erro ao salvar bloco global',
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <Library className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold text-sm truncate">{global.name}</span>
          {saving && <span className="text-[10px] text-muted-foreground">salvando…</span>}
        </div>
        {global.description && (
          <div className="text-xs text-muted-foreground">{global.description}</div>
        )}
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="px-1.5 py-0.5 rounded bg-muted border border-border">
            {global.category}
          </span>
          <span>{BLOCK_LABELS[global.block.kind] || global.block.kind}</span>
          <span>·</span>
          <span>
            usado em {usageCount} {usageCount === 1 ? 'template' : 'templates'}
          </span>
        </div>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
        ⚠️ <strong>Bloco compartilhado.</strong> Alterações aqui refletem em{' '}
        <strong>todos os {usageCount} templates</strong> que o utilizam.
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Propriedades do bloco global
        </div>
        {/* Reaproveita o painel padrão — edições disparam updateGlobal */}
        <BlockPropsPanel block={global.block} onChange={handleInnerChange} />
      </div>

      <div className="pt-3 border-t">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (
              !confirm(
                'Desfazer o vínculo com a biblioteca? O bloco vira uma cópia local deste template. Outros templates continuam usando o global normalmente.'
              )
            )
              return;
            // Passa cópia do inner com novo id local
            onUnlink({
              ...global.block,
              id: `b${Date.now()}${Math.floor(Math.random() * 1000)}`,
            } as Block);
          }}
          className="w-full"
        >
          <Unlink className="w-3.5 h-3.5 mr-1.5" />
          Desfazer vínculo (converter em bloco local)
        </Button>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Útil quando você quer customizar este bloco só neste template.
        </p>
      </div>
    </div>
  );
}
