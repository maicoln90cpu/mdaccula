import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EventForm } from '@/components/events/EventForm';
import { supabase } from '@/integrations/supabase/client';

class ROStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = ROStub;
(window as any).ResizeObserver = ROStub;

const renderForm = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

/**
 * Regressão: ao abrir o modal de edição com pix_button_enabled=true,
 * o toggle do botão Pix deve aparecer ON (data-state="checked").
 */

function buildChain(rows: any[] = []) {
  const thenable: any = {
    select: vi.fn(() => thenable),
    insert: vi.fn(() => thenable),
    update: vi.fn(() => thenable),
    delete: vi.fn(() => thenable),
    eq: vi.fn(() => thenable),
    in: vi.fn(() => thenable),
    order: vi.fn(() => thenable),
    limit: vi.fn(() => thenable),
    maybeSingle: vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null }),
    single: vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null }),
    then: (resolve: any) => Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  return thenable;
}

beforeEach(() => {
  (supabase.from as any) = vi.fn(() => buildChain([]));
});

const baseEvent = {
  id: 'evt-1',
  title: 'Sun',
  slug: 'sun190926',
  venue: 'Local X',
  address: 'Rua Y',
  location_state: 'SP',
  location_city: 'São Paulo',
  date: '2026-09-19',
  end_date: null,
  time: '20:00',
  end_time: '04:00',
  genres: ['House'],
  lineup: [],
  ticket_link: 'https://tickets.example.com',
  vip_link: 'https://api.whatsapp.com/send?phone=5511997819194&text=Ol%C3%A1%20Gui',
  description: 'desc',
  subtitle: 'sub',
  image_url: null,
  blog_post_id: null,
  ai_context: '',
};

describe('EventForm — toggle Pix persiste estado do banco', () => {
  it('mostra o Switch ON quando pix_button_enabled=true vem do evento', async () => {
    renderForm(
      <EventForm
        event={{ ...baseEvent, pix_button_enabled: true }}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const switchEl = await waitFor(() => {
      const el = document.getElementById('pix_button_enabled');
      if (!el) throw new Error('Switch Pix não encontrado');
      return el;
    });

    expect(switchEl.getAttribute('data-state')).toBe('checked');
    expect(switchEl.getAttribute('aria-checked')).toBe('true');
  });

  it('mostra o Switch OFF quando pix_button_enabled=false', async () => {
    renderForm(
      <EventForm
        event={{ ...baseEvent, pix_button_enabled: false }}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const switchEl = await waitFor(() => {
      const el = document.getElementById('pix_button_enabled');
      if (!el) throw new Error('Switch Pix não encontrado');
      return el;
    });

    expect(switchEl.getAttribute('data-state')).toBe('unchecked');
  });

  it('mostra OFF quando o campo está ausente (default seguro)', async () => {
    const { pix_button_enabled: _omit, ...evNoField } = {
      ...baseEvent,
      pix_button_enabled: undefined,
    } as any;
    renderForm(<EventForm event={evNoField} onSuccess={vi.fn()} onCancel={vi.fn()} />);

    const switchEl = await waitFor(() => {
      const el = document.getElementById('pix_button_enabled');
      if (!el) throw new Error('Switch Pix não encontrado');
      return el;
    });

    expect(switchEl.getAttribute('data-state')).toBe('unchecked');
  });
});
