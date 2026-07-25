/**
 * Painel de propriedades por tipo de bloco.
 *
 * Onda 10: dispatcher enxuto — cada grupo de blocos vive em um sub-painel
 * dedicado dentro de `blockPropsPanel/`. Mudanças em um grupo não obrigam a
 * recompilar/re-renderizar os outros.
 */
import { type Block } from '@/lib/emailTemplates/blocks';
import { renderStructuralProps } from './blockPropsPanel/structuralProps';
import { renderTextProps } from './blockPropsPanel/textProps';
import { renderActionProps } from './blockPropsPanel/actionProps';
import { renderEventProps } from './blockPropsPanel/eventProps';
import { renderDigestProps } from './blockPropsPanel/digestProps';

export function BlockPropsPanel({
  block,
  onChange,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
}) {
  const patch = (p: Record<string, unknown>) => onChange(p as Partial<Block>);

  const rendered =
    renderStructuralProps(block, patch) ??
    renderTextProps(block, patch) ??
    renderActionProps(block, patch) ??
    renderEventProps(block, patch) ??
    renderDigestProps(block, patch);

  if (rendered) return rendered;

  return (
    <p className="text-sm text-muted-foreground">
      Este bloco não tem propriedades editáveis — sua aparência vem dos dados do evento.
    </p>
  );
}
