/**
 * BlockListPanel — coluna esquerda: lista drag-and-drop + adicionar bloco + biblioteca de globais.
 * Extraído do EmailTemplateEditor na Onda 12 sem alterações de comportamento.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  type Block,
  BLOCK_LABELS,
  AVAILABLE_BLOCKS,
  type GlobalBlock,
} from '@/lib/emailTemplates/blocks';
import { GlobalBlocksLibrary } from '../GlobalBlocksLibrary';
import { SortableRow } from './controls';

interface BlockListPanelProps {
  blocks: Block[];
  selectedBlockId: string | null;
  selectedBlock: Block | null;
  globalsMap: Map<string, EmailGlobalBlock>;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleHidden: (b: Block) => void;
  onDragEnd: (e: DragEndEvent) => void;
  onAddBlock: (kind: Block['kind']) => void;
  onInsertFromLibrary: (b: Block) => void;
}

export const BlockListPanel = ({
  blocks,
  selectedBlockId,
  selectedBlock,
  globalsMap,
  onSelect,
  onRemove,
  onDuplicate,
  onToggleHidden,
  onDragEnd,
  onAddBlock,
  onInsertFromLibrary,
}: BlockListPanelProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
          Blocos do e-mail
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
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
                    onSelect={() => onSelect(b.id)}
                    onRemove={() => onRemove(b.id)}
                    onDuplicate={() => onDuplicate(b.id)}
                    onToggleHidden={() => onToggleHidden(b)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        <div className="pt-3 border-t mt-3">
          <Label className="text-xs mb-1 block">Adicionar bloco</Label>
          <Select onValueChange={(v) => onAddBlock(v as Block['kind'])}>
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
          <GlobalBlocksLibrary selectedBlock={selectedBlock} onInsert={onInsertFromLibrary} />
        </div>
      </CardContent>
    </Card>
  );
};
