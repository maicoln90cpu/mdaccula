/**
 * Regressão — um card-vitrine (is_merge_shell=true) ou um evento já
 * escondido por outra mesclagem (merged_into_id preenchido) não pode ser
 * selecionado de novo no modo "Mesclar", senão criaria mesclagens
 * encadeadas (A→B→C) que a aba "Eventos Mesclados" não sabe resolver.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventCard } from '@/pages/admin/eventsManager/EventCard';

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    title: 'Evento',
    subtitle: '',
    slug: 'evento',
    venue: 'Venue',
    address: '',
    date: '2026-12-28',
    end_date: null,
    time: '16:00',
    location_city: 'São Paulo',
    location_state: 'SP',
    genres: [],
    image_url: null,
    blog_post_id: null,
    description: '',
    lineup: [],
    ticket_link: '',
    vip_link: '',
    pix_button_enabled: false,
    views: 0,
    status: 'active',
    merged_into_id: null,
    merged_at: null,
    is_merge_shell: false,
    ...overrides,
  };
}

const noop = () => {};

describe('EventCard — trava contra re-mesclar', () => {
  it('não permite clicar pra selecionar um card-vitrine no modo mesclar', () => {
    const onToggleSelect = vi.fn();
    render(
      <EventCard
        event={baseEvent({ is_merge_shell: true })}
        mergeMode={true}
        selected={false}
        onToggleSelect={onToggleSelect}
        onEdit={noop}
        onDuplicate={noop}
        onGenerateArticle={noop}
        onReactivate={noop}
        onDelete={noop}
        generatingArticle={null}
        reactivatingId={null}
        mergedPrimaryTitles={{}}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
  });

  it('permite clicar normalmente num evento comum (não é shell, não está escondido)', () => {
    render(
      <EventCard
        event={baseEvent()}
        mergeMode={true}
        selected={false}
        onToggleSelect={noop}
        onEdit={noop}
        onDuplicate={noop}
        onGenerateArticle={noop}
        onReactivate={noop}
        onDelete={noop}
        generatingArticle={null}
        reactivatingId={null}
        mergedPrimaryTitles={{}}
      />
    );

    expect(screen.getByRole('checkbox')).not.toBeDisabled();
  });
});
