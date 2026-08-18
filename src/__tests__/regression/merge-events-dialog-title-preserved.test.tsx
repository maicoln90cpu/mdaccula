/**
 * Regressão R-024 (adaptada ao modelo não-destrutivo, 18/08/2026) — o nome
 * customizado digitado em "Nome do festival" não pode ser descartado por
 * nenhum outro estado do modal mudando (imagem, switch de ticket por dia).
 * No modelo antigo isso acontecia ao trocar qual evento era o "principal";
 * esse conceito não existe mais, mas a mesma classe de bug (efeito que
 * resincroniza um campo já editado manualmente) continua valendo a pena
 * proteger.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { MergeEventsDialog } from '@/components/admin/MergeEventsDialog';

const eventA = {
  id: 'event-a',
  title: 'Evento A',
  slug: 'evento-a',
  date: '2026-12-28',
  end_date: null,
  venue: 'Venue A',
  image_url: null,
};

const eventB = {
  id: 'event-b',
  title: 'Evento B',
  slug: 'evento-b',
  date: '2026-12-29',
  end_date: null,
  venue: 'Venue B',
  image_url: null,
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

describe('Regressão R-024 — MergeEventsDialog preserva nome customizado', () => {
  it('não sobrescreve o nome digitado quando o admin alterna a aba de imagem', () => {
    renderDialog();

    const titleInput = screen.getByLabelText(/nome do festival/i);
    fireEvent.change(titleInput, { target: { value: 'Nome Customizado' } });
    expect(titleInput).toHaveValue('Nome Customizado');

    fireEvent.click(screen.getByRole('tab', { name: /enviar nova imagem/i }));
    expect(titleInput).toHaveValue('Nome Customizado');
  });

  it('sugere o título do primeiro evento selecionado quando o campo ainda não foi editado', () => {
    renderDialog();
    const titleInput = screen.getByLabelText(/nome do festival/i);
    expect(titleInput).toHaveValue('Evento A');
  });

  it('não existe mais nenhum seletor de "evento principal"', () => {
    renderDialog();
    expect(screen.queryByText(/escolha o evento principal/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});
