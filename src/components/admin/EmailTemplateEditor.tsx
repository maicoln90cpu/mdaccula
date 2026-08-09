/**
 * Editor de blocos para templates de e-mail (orquestrador).
 *
 * Onda 12 (slim-down): 903 → ~340 linhas. Extraído em `./emailTemplateEditor/`:
 *   - blockDefaults.ts   → configurações iniciais por tipo de bloco
 *   - typeFilter.ts      → constantes/labels/helpers do Passo 1
 *   - EditorHeader.tsx   → Passo 1 + Passo 2 + inputs de nome/assunto/preheader
 *   - BlockListPanel.tsx → coluna esquerda (DnD + adicionar + biblioteca globais)
 *   - PreviewPanel.tsx   → coluna direita (iframe preview + banners)
 *   - BlockPropsPanel + GlobalRefPropsPanel (já existentes)
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { useToast } from '@/hooks/useToast';
import {
  type Block,
  type Template,
  newBlockId,
  type ArticleSummary,
  TEMPLATE_PRESETS,
  buildPresetBlocks,
  type PresetKey,
} from '@/lib/emailTemplates/blocks';
import { composeEmail } from '@/lib/emailTemplates/emailComposer';
import {
  type EventAnnouncementData,
  type EmailTemplateSettings,
} from '@/lib/emailTemplates/eventAnnouncement';
import { useEmailGlobalBlocks } from '@/hooks/useEmailGlobalBlocks';
import { BlockPropsPanel } from './emailTemplateEditor/BlockPropsPanel';
import { GlobalRefPropsPanel } from './emailTemplateEditor/GlobalRefPropsPanel';
import { BlockListPanel } from './emailTemplateEditor/BlockListPanel';
import { PreviewPanel } from './emailTemplateEditor/PreviewPanel';
import { EditorHeader } from './emailTemplateEditor/EditorHeader';
import { defaultForKind } from './emailTemplateEditor/blockDefaults';
import {
  TYPE_FILTER_ORDER,
  TYPE_FILTER_STORAGE_KEY,
  normalizeType,
  type TypeFilterKey,
} from './emailTemplateEditor/typeFilter';

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

  // Undo/redo (item 2 da melhoria) — só para mudanças ESTRUTURAIS na lista
  // de blocos (adicionar/remover/duplicar/reordenar/desfazer vínculo), não
  // por tecla digitada num campo de texto (isso já teria granularidade
  // ruim demais e é coberto pela proteção de "alterações não salvas").
  const [undoStack, setUndoStack] = useState<Block[][]>([]);
  const [redoStack, setRedoStack] = useState<Block[][]>([]);
  const MAX_UNDO_HISTORY = 50;

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
      event_reminder: 0,
      courtesy: 0,
      promo: 0,
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

  /** Toda mudança ESTRUTURAL na lista de blocos passa por aqui — empilha o
   * estado anterior pro undo e limpa o redo (uma edição nova invalida o
   * "futuro" que existia antes dela). */
  const applyBlocksChange = (next: Block[]) => {
    setUndoStack((prev) => [...prev, blocks].slice(-MAX_UNDO_HISTORY));
    setRedoStack([]);
    setLocalBlocks(next);
  };

  const undoBlocks = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack((prev) => [...prev, blocks].slice(-MAX_UNDO_HISTORY));
    setLocalBlocks(previous);
  };

  const redoBlocks = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(redoStack.slice(0, -1));
    setUndoStack((prev) => [...prev, blocks].slice(-MAX_UNDO_HISTORY));
    setLocalBlocks(next);
  };

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const oldIdx = blocks.findIndex((b) => b.id === active.id);
      const newIdx = blocks.findIndex((b) => b.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return;
      applyBlocksChange(arrayMove(blocks, oldIdx, newIdx));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocks]
  );

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setLocalBlocks(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  };

  /** Substitui integralmente um bloco (sem merge). Usado para "desfazer vínculo" de global_ref. */
  const replaceBlock = (id: string, next: Block) => {
    applyBlocksChange(blocks.map((b) => (b.id === id ? next : b)));
  };

  const addBlock = (kind: Block['kind']) => {
    const created = defaultForKind(kind);
    applyBlocksChange([...blocks, created]);
    // Auto-seleciona o bloco recém-adicionado — antes o admin precisava
    // procurar na lista à esquerda pra começar a editar.
    setSelectedBlockId(created.id);
  };

  const removeBlock = (id: string) => {
    applyBlocksChange(blocks.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const duplicateBlock = (id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const clone = { ...blocks[idx], id: newBlockId() };
    const next = [...blocks];
    next.splice(idx + 1, 0, clone);
    applyBlocksChange(next);
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
      setUndoStack([]);
      setRedoStack([]);
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
      const newBlocks = preset
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
          blocks: newBlocks,
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
          type: activeTpl.type,
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
    setUndoStack([]);
    setRedoStack([]);
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
    setUndoStack([]);
    setRedoStack([]);
    setTypeFilter(nextType);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TYPE_FILTER_STORAGE_KEY, nextType);
    }
    const firstOfType = templates.find((t) => normalizeType(t.type) === nextType);
    onActiveChange(firstOfType?.id ?? '');
  };

  // Atalhos de teclado Ctrl/Cmd+Z (desfazer) e Ctrl/Cmd+Shift+Z (refazer) —
  // só quando o foco não está num campo de texto, pra não atrapalhar o
  // undo nativo do navegador dentro de inputs/textareas.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      e.preventDefault();
      if (e.shiftKey) redoBlocks();
      else undoBlocks();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoStack, redoStack, blocks]);

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
      <EditorHeader
        typeFilter={typeFilter}
        countsByType={countsByType}
        onTypeFilterChange={handleTypeFilterChange}
        filteredTemplates={filteredTemplates}
        activeId={activeId}
        activeTpl={activeTpl}
        isDirty={isDirty}
        saving={saving}
        currentName={currentName}
        currentSubject={currentSubject}
        currentPreheader={currentPreheader}
        onActiveChange={handleActiveChange}
        onCreateTemplate={createTemplate}
        onDuplicateTemplate={duplicateTemplate}
        onDeleteTemplate={deleteTemplate}
        onSaveTemplate={saveTemplate}
        onNameChange={setLocalName}
        onSubjectChange={setLocalSubject}
        onPreheaderChange={setLocalPreheader}
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr_1fr]">
        <BlockListPanel
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          selectedBlock={selectedBlock}
          globalsMap={globalsMap}
          onSelect={setSelectedBlockId}
          onRemove={removeBlock}
          onDuplicate={duplicateBlock}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={undoBlocks}
          onRedo={redoBlocks}
          onToggleHidden={(b) =>
            updateBlock(b.id, {
              hidden: !(b as { hidden?: boolean }).hidden,
            } as unknown as Partial<Block>)
          }
          onDragEnd={handleDragEnd}
          onAddBlock={addBlock}
          onInsertFromLibrary={(b) => setLocalBlocks([...(blocks as Block[]), b])}
        />

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
                // key força remontar o painel ao trocar de bloco global
                // selecionado — sem isso, o debounce/rascunho local de
                // edição (ver GlobalRefPropsPanel) ficaria "grudado" no
                // global anterior por uma fração de segundo.
                key={(selectedBlock as Extract<Block, { kind: 'global_ref' }>).global_id}
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

        <PreviewPanel
          html={previewComposition.html}
          overrideHtml={overrideHtml}
          isDirty={isDirty}
          issues={previewComposition.issues}
          currentSubject={currentSubject}
          currentPreheader={currentPreheader}
          previewEvent={previewEvent}
        />
      </div>
    </div>
  );
}
