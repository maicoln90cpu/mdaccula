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
import { BlockPropsPanel } from './emailTemplateEditor/BlockPropsPanel';
import { GlobalRefPropsPanel } from './emailTemplateEditor/GlobalRefPropsPanel';
import { SortableRow } from './emailTemplateEditor/controls';

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


// Fase 3 — Fluxo Editor em 2 passos:
//   1º) tipo do template (Evento / Virada / Agenda FDS / Digest / Custom)
//   2º) template daquele tipo
// Persistimos a escolha em localStorage para lembrar entre sessões.
type TypeFilterKey =
  | 'event_new'
  | 'ticket_batch'
  | 'ticket_batch_multi'
  | 'weekend_agenda'
  | 'weekly_digest'
  | 'blog_digest'
  | 'courtesy'
  | 'custom';
const TYPE_FILTER_ORDER: TypeFilterKey[] = [
  'event_new',
  'ticket_batch',
  'ticket_batch_multi',
  'weekend_agenda',
  'weekly_digest',
  'blog_digest',
  'courtesy',
  'custom',
];
const TYPE_FILTER_LABELS: Record<TypeFilterKey, string> = {
  event_new: 'Evento',
  ticket_batch: 'Virada',
  ticket_batch_multi: 'Virada (multi)',
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
      ticket_batch_multi: 0,
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

