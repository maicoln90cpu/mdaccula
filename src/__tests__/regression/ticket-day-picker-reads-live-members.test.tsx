/**
 * Regressão — o seletor de dia de ingresso de um evento mesclado precisa ler
 * direto dos eventos escondidos (events.merged_into_id), NÃO de uma cópia em
 * custom_links. Isso garante que editar o link de venda de um dia depois da
 * mesclagem reflete na hora, sem nenhuma sincronização manual — ver
 * docs/superpowers/specs/2026-08-17-event-merge-nondestructive-redesign-design.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const fromMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { TicketDayPickerModal } from '@/components/events/TicketDayPickerModal';

describe('TicketDayPickerModal — busca os dias direto dos eventos escondidos', () => {
  it('consulta events filtrando por merged_into_id (não mais custom_links)', async () => {
    let queriedTable = '';
    let queriedColumn = '';
    let queriedValue = '';

    fromMock.mockImplementation((table: string) => {
      queriedTable = table;
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            queriedColumn = column;
            queriedValue = value;
            return Promise.resolve({
              data: [
                {
                  title: 'Dia 1 — Artista A',
                  date: '2026-12-28',
                  ticket_link: 'https://exemplo.com/dia28',
                },
                {
                  title: 'Dia 2 — Artista B',
                  date: '2026-12-29',
                  ticket_link: 'https://exemplo.com/dia29',
                },
              ],
              error: null,
            });
          },
        }),
      };
    });

    render(
      <TicketDayPickerModal
        open={true}
        onOpenChange={() => {}}
        eventId="shell-1"
        eventTitle="Festival Teste"
        schedule={[
          { date: '2026-12-28', time: '16:00', end_time: null, lineup: [] },
          { date: '2026-12-29', time: '16:00', end_time: null, lineup: [] },
        ]}
        fallbackTicketLink={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Dia 1 — Artista A/i })).toBeInTheDocument();
    });

    expect(queriedTable).toBe('events');
    expect(queriedColumn).toBe('merged_into_id');
    expect(queriedValue).toBe('shell-1');

    const link28 = screen.getByRole('link', { name: /Dia 1 — Artista A/i });
    expect(link28).toHaveAttribute('href', 'https://exemplo.com/dia28');
    const link29 = screen.getByRole('link', { name: /Dia 2 — Artista B/i });
    expect(link29).toHaveAttribute('href', 'https://exemplo.com/dia29');
  });
});
