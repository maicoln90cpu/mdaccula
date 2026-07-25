/**
 * Painel para bloco global_ref.
 * Extraído de EmailTemplateEditor.tsx (Onda 1 PR-A) sem mudança de comportamento.
 */
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Library, Unlink } from 'lucide-react';
import {
  type Block,
  type Template,
  type GlobalBlock,
  BLOCK_LABELS,
} from '@/lib/emailTemplates/blocks';
import { BlockPropsPanel } from './BlockPropsPanel';

export function GlobalRefPropsPanel({
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
