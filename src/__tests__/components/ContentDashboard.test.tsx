import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const fromMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { ContentDashboard } from '@/components/admin/ai-content/ContentDashboard';

const BLOG_POSTS = [
  {
    id: 'p1',
    title: 'Post publicado 1',
    slug: 'post-1',
    category: 'Cena',
    published: true,
    published_at: '2026-08-01T00:00:00Z',
    created_at: '2026-08-01T00:00:00Z',
    views: 120,
  },
  {
    id: 'p2',
    title: 'Post rascunho',
    slug: 'post-2',
    category: 'Cena',
    published: false,
    published_at: null,
    created_at: '2026-08-02T00:00:00Z',
    views: 5,
  },
];

const AI_GENERATED = [
  { blog_post_id: 'p1', generation_source: 'auto_cron', generated_at: '2026-08-01T00:00:00Z' },
  { blog_post_id: 'p2', generation_source: 'gerar_tab', generated_at: '2026-08-02T00:00:00Z' },
];

function mockTables() {
  fromMock.mockImplementation((table: string) => {
    if (table === 'blog_posts') {
      return { select: () => ({ order: () => Promise.resolve({ data: BLOG_POSTS, error: null }) }) };
    }
    if (table === 'ai_generated_posts') {
      return { select: () => Promise.resolve({ data: AI_GENERATED, error: null }) };
    }
    if (table === 'blog_view_events') {
      return { select: () => ({ gte: () => Promise.resolve({ data: [], error: null }) }) };
    }
    if (table === 'application_logs') {
      return {
        select: () => ({ ilike: () => ({ gte: () => Promise.resolve({ data: [], error: null }) }) }),
      };
    }
    throw new Error(`tabela não mockada: ${table}`);
  });
}

describe('ContentDashboard', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('mostra os cards de publicados/rascunhos/visualizações a partir dos dados reais', async () => {
    mockTables();
    render(<ContentDashboard />);

    await waitFor(() => expect(screen.getByText('Post publicado 1')).toBeInTheDocument());
    expect(screen.getByText('Publicados')).toBeInTheDocument();
    expect(screen.getByText('Rascunhos pendentes')).toBeInTheDocument();
    // 1 publicado, 1 rascunho, 125 views totais (120+5), 1 publicado sem revisão (auto_cron)
    expect(screen.getAllByText('1')).not.toHaveLength(0);
    expect(screen.getByText('125')).toBeInTheDocument();
  });

  it('estado vazio quando não há nenhum post', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'blog_posts') return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) };
      if (table === 'ai_generated_posts') return { select: () => Promise.resolve({ data: [], error: null }) };
      if (table === 'blog_view_events') return { select: () => ({ gte: () => Promise.resolve({ data: [], error: null }) }) };
      return { select: () => ({ ilike: () => ({ gte: () => Promise.resolve({ data: [], error: null }) }) }) };
    });
    render(<ContentDashboard />);
    await waitFor(() =>
      expect(screen.getByText(/Nenhum artigo gerado ainda/)).toBeInTheDocument()
    );
  });
});
