/**
 * Regressão — "Desfazer mesclagem" precisa funcionar em QUALQUER mesclagem,
 * de qualquer idade, sem depender de nenhum snapshot em application_logs
 * (foi a ausência desse snapshot que impediu o desfazer automático do merge
 * "Parador Reveillon", exigindo reversão manual via SQL em 17/08/2026).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fromMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { UndoMergeDialog } from '@/components/admin/UndoMergeDialog';

describe('UndoMergeDialog — desfaz lendo o grupo direto de events, sem application_logs', () => {
  it('lista os membros do grupo e nunca consulta application_logs', async () => {
    const calledTables: string[] = [];
    fromMock.mockImplementation((table: string) => {
      calledTables.push(table);
      return {
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [
                { id: 'm1', title: 'Dia 29', merged_at: '2026-08-01T00:00:00Z' },
                { id: 'm2', title: 'Dia 30', merged_at: '2026-08-01T00:00:00Z' },
              ],
              error: null,
            }),
        }),
      };
    });

    render(
      <UndoMergeDialog
        open={true}
        onOpenChange={() => {}}
        shell={{ id: 'shell-1', title: 'Festival Teste' }}
        onSuccess={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Dia 29, Dia 30/)).toBeInTheDocument();
    });

    expect(calledTables).not.toContain('application_logs');
  });

  it('ao confirmar, reativa os membros e inativa o card-vitrine', async () => {
    const updateCalls: { table: string; payload: unknown }[] = [];
    fromMock.mockImplementation((table: string) => ({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [{ id: 'm1', title: 'Dia 29', merged_at: '2026-08-01T00:00:00Z' }],
            error: null,
          }),
      }),
      update: (payload: unknown) => ({
        eq: () => {
          updateCalls.push({ table, payload });
          return Promise.resolve({ error: null });
        },
      }),
    }));

    render(
      <UndoMergeDialog
        open={true}
        onOpenChange={() => {}}
        shell={{ id: 'shell-1', title: 'Festival Teste' }}
        onSuccess={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar desfazer/i })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: /confirmar desfazer/i }));

    await waitFor(() => {
      expect(updateCalls).toHaveLength(2);
    });
    expect(updateCalls[0].payload).toMatchObject({ status: 'active', merged_into_id: null });
    expect(updateCalls[1].payload).toMatchObject({ status: 'merged_inactive' });
  });
});
