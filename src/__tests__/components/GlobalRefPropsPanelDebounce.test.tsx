import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import { GlobalRefPropsPanel } from '@/components/admin/emailTemplateEditor/GlobalRefPropsPanel';
import type { Block, GlobalBlock } from '@/lib/emailTemplates/blocks';

/**
 * Regressão — edição de bloco global disparava um UPDATE + reload completo
 * da biblioteca a CADA tecla digitada (sem debounce). Respostas fora de
 * ordem podiam fazer o texto "regredir" no meio da digitação, e uma frase
 * de N caracteres gerava N escritas no banco. Agora só o último patch,
 * depois de uma pausa, é persistido de verdade.
 */

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function buildGlobal(): GlobalBlock {
  return {
    id: 'global-1',
    name: 'Etiqueta padrão',
    description: null,
    category: 'geral',
    block: { id: 'template', kind: 'eyebrow', text: 'Original' } as unknown as Block,
  } as GlobalBlock;
}

function buildRefBlock(): Extract<Block, { kind: 'global_ref' }> {
  return { id: 'ref-1', kind: 'global_ref', global_id: 'global-1' } as Extract<
    Block,
    { kind: 'global_ref' }
  >;
}

describe('GlobalRefPropsPanel — debounce ao editar bloco global', () => {
  it('digitar várias letras seguidas só chama updateGlobal UMA vez, com o texto final', async () => {
    vi.useFakeTimers();
    const global = buildGlobal();
    const globalsMap = new Map<string, GlobalBlock>([[global.id, global]]);
    const updateGlobal = vi.fn().mockResolvedValue(undefined);

    render(
      <GlobalRefPropsPanel
        refBlock={buildRefBlock()}
        templates={[]}
        globalsMap={globalsMap}
        updateGlobal={updateGlobal}
        onUnlink={() => {}}
        onToast={() => {}}
      />
    );

    const input = screen.getByDisplayValue('Original') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Original G' } });
    fireEvent.change(input, { target: { value: 'Original Ga' } });
    fireEvent.change(input, { target: { value: 'Original Gan' } });
    fireEvent.change(input, { target: { value: 'Original Gang' } });

    // Nenhum save disparado ainda — só o rascunho local, refletido na hora.
    expect(updateGlobal).not.toHaveBeenCalled();
    expect(input.value).toBe('Original Gang');

    await vi.advanceTimersByTimeAsync(700);

    expect(updateGlobal).toHaveBeenCalledTimes(1);
    expect(updateGlobal).toHaveBeenCalledWith(
      'global-1',
      expect.objectContaining({ block: expect.objectContaining({ text: 'Original Gang' }) })
    );
  });
});
