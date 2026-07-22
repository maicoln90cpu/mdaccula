/**
 * Regressão — ao mesclar eventos, o nome customizado digitado em "Nome do
 * festival" era descartado silenciosamente sempre que o admin trocava qual
 * evento seria o "principal" depois de já ter digitado o nome (ou na
 * primeira seleção de principal, já que o dialog fica montado permanente-
 * mente em EventsManager com `events=[]` até o admin marcar os checkboxes).
 *
 * Causa: o useEffect que sincroniza `mergedTitle` com o título do evento
 * principal disparava em TODA troca de `primary.id` (via `primaryRef`),
 * sem checar se o campo já tinha sido editado manualmente — sobrescrevendo
 * o texto digitado. Confirmado via log de auditoria em produção: um merge
 * real gravou `new_title` igual ao título original do evento principal,
 * mesmo o admin relatando ter digitado um nome customizado.
 *
 * Correção: um flag `titleTouched` (setado no onChange do input) impede
 * que o useEffect de sincronização sobrescreva o campo depois que o admin
 * começa a editá-lo manualmente.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MergeEventsDialog } from '@/components/admin/MergeEventsDialog';

const eventA = {
  id: 'event-a',
  title: 'Evento A',
  slug: 'evento-a',
  date: '2026-12-28',
  end_date: null,
  venue: 'Venue A',
};

const eventB = {
  id: 'event-b',
  title: 'Evento B',
  slug: 'evento-b',
  date: '2026-12-29',
  end_date: null,
  venue: 'Venue B',
};

function renderDialog() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MergeEventsDialog
        open={true}
        onOpenChange={() => {}}
        events={[eventA, eventB]}
        onSuccess={() => {}}
      />
    </QueryClientProvider>
  );
}

describe('Regressão — MergeEventsDialog preserva nome customizado ao trocar o principal', () => {
  it('não sobrescreve o nome digitado quando o admin troca o evento principal depois de editar', () => {
    renderDialog();

    const titleInput = screen.getByLabelText(/nome do festival/i);
    fireEvent.change(titleInput, { target: { value: 'Nome Customizado' } });
    expect(titleInput).toHaveValue('Nome Customizado');

    // Troca o principal de "Evento A" (padrão) para "Evento B".
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]);

    expect(titleInput).toHaveValue('Nome Customizado');
  });

  it('continua auto-preenchendo com o título do principal quando o campo ainda não foi editado', () => {
    renderDialog();

    const titleInput = screen.getByLabelText(/nome do festival/i);
    expect(titleInput).toHaveValue('Evento A');

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]);

    expect(titleInput).toHaveValue('Evento B');
  });
});
