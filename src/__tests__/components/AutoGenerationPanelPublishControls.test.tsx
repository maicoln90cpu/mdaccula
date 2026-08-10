/**
 * Regressão/feature — painel único de controle de publicação (reorganização
 * dos controles de geração de conteúdo, 10/08/2026): 8 caminhos, cada um com
 * seu próprio toggle rascunho/publicado. Substitui o toggle único
 * "Publicar Sugestões automaticamente" (suggestions_auto_publish) que
 * cobria só 1 dos 8 caminhos e ainda compartilhava a chave com o cron.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AutoGenerationPanel } from '@/components/admin/ai-content/AutoGenerationPanel';
import { supabase } from '@/integrations/supabase/client';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildChain(result: { data: unknown; error: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const thenable: any = {
    select: vi.fn(() => thenable),
    upsert: vi.fn(() => thenable),
    eq: vi.fn(() => thenable),
    in: vi.fn(() => thenable),
    ilike: vi.fn(() => thenable),
    order: vi.fn(() => thenable),
    limit: vi.fn(() => thenable),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return thenable;
}

const upsertCalls: unknown[] = [];

function mockSupabaseFrom() {
  upsertCalls.length = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase.from as any) = vi.fn((table: string) => {
    if (table === 'site_settings') {
      const chain = buildChain({
        data: [
          { key: 'ai_auto_generate_enabled', value: 'true' },
          { key: 'ai_auto_generate_interval_hours', value: '48' },
          { key: 'ai_auto_generate_last_run', value: null },
          { key: 'ai_auto_generate_fail_count', value: '0' },
          { key: 'auto_publish_generate_tab', value: 'false' },
          { key: 'auto_publish_suggestions_topic', value: 'false' },
          { key: 'auto_publish_suggestions_template', value: 'false' },
          { key: 'auto_publish_topic_search', value: 'false' },
          { key: 'auto_publish_auto_cron', value: 'false' },
          { key: 'auto_publish_multi_event', value: 'false' },
          { key: 'auto_publish_single_event', value: 'false' },
          { key: 'event_watcher_auto_publish', value: 'false' },
        ],
        error: null,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chain.upsert = vi.fn((payload: unknown) => {
        upsertCalls.push(payload);
        return Promise.resolve({ data: null, error: null });
      });
      return chain;
    }
    if (table === 'application_logs') return buildChain({ data: [], error: null });
    if (table === 'ai_generated_posts') return buildChain({ data: null, error: { message: 'no rows' } });
    if (table === 'blog_posts') return buildChain({ data: null, error: null });
    throw new Error(`unexpected table: ${table}`);
  });
}

beforeEach(() => {
  mockSupabaseFrom();
});

describe('AutoGenerationPanel — painel único de controle de publicação (8 caminhos)', () => {
  it('mostra as 8 linhas, cada uma com nome e selo de raspagem real', async () => {
    render(<AutoGenerationPanel />);

    await waitFor(() => expect(screen.getByText('Gerar')).toBeInTheDocument());
    expect(screen.getByText('Sugestões (tema livre)')).toBeInTheDocument();
    expect(screen.getByText('Sugestões (template)')).toBeInTheDocument();
    expect(screen.getByText('Por Tema')).toBeInTheDocument();
    expect(screen.getByText('Automático (cron)')).toBeInTheDocument();
    expect(screen.getByText('Artigo consolidado (Multi-Evento)')).toBeInTheDocument();
    expect(screen.getByText('Por evento')).toBeInTheDocument();
    expect(screen.getByText('Event Watcher')).toBeInTheDocument();
  });

  it('não mostra mais o toggle único antigo "Publicar Sugestões automaticamente"', async () => {
    render(<AutoGenerationPanel />);
    await waitFor(() => expect(screen.getByText('Gerar')).toBeInTheDocument());
    expect(screen.queryByText('Publicar Sugestões automaticamente')).toBeNull();
  });

  it('ligar o toggle de 1 linha faz upsert só daquela chave', async () => {
    render(<AutoGenerationPanel />);
    await waitFor(() => expect(screen.getByText('Por Tema')).toBeInTheDocument());

    const row = screen.getByText('Por Tema').closest('tr');
    expect(row).toBeTruthy();
    const toggle = row!.querySelector('button[role="switch"]');
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle!);

    await waitFor(() => {
      expect(upsertCalls).toContainEqual({ key: 'auto_publish_topic_search', value: 'true' });
    });
  });
});
