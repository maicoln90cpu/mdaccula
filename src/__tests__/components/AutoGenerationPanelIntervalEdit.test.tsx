/**
 * Regressão — `ai_auto_generate_interval_hours` não tinha nenhuma UI de
 * edição no admin (só exibia o valor, mudar exigia update direto no banco).
 * Achado durante a investigação de "geração por tema" (ver docs/PENDENCIAS.md,
 * decisão resolvida em R-048/Fase 1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AutoGenerationPanel } from '@/components/admin/ai-content/AutoGenerationPanel';
import { supabase } from '@/integrations/supabase/client';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

function buildChain(result: { data: unknown; error: unknown }) {
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
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return thenable;
}

const upsertCalls: unknown[] = [];

function mockSupabaseFrom(intervalHours = '48') {
  upsertCalls.length = 0;
  (supabase.from as any) = vi.fn((table: string) => {
    if (table === 'site_settings') {
      const chain = buildChain({
        data: [
          { key: 'ai_auto_generate_enabled', value: 'true' },
          { key: 'ai_auto_generate_interval_hours', value: intervalHours },
          { key: 'ai_auto_generate_last_run', value: null },
          { key: 'ai_auto_generate_fail_count', value: '0' },
          { key: 'suggestions_auto_publish', value: 'false' },
        ],
        error: null,
      });
      chain.upsert = vi.fn((payload: unknown) => {
        upsertCalls.push(payload);
        return Promise.resolve({ data: null, error: null });
      });
      return chain;
    }
    if (table === 'application_logs') {
      return buildChain({ data: [], error: null });
    }
    if (table === 'ai_generated_posts') {
      return buildChain({ data: null, error: { message: 'no rows' } });
    }
    if (table === 'blog_posts') {
      return buildChain({ data: null, error: null });
    }
    throw new Error(`unexpected table: ${table}`);
  });
}

beforeEach(() => {
  mockSupabaseFrom();
});

describe('AutoGenerationPanel — edição do intervalo de auto-geração', () => {
  it('carrega o intervalo salvo (48h) no campo editável', async () => {
    render(<AutoGenerationPanel />);

    const input = await waitFor(() => screen.getByDisplayValue('48') as HTMLInputElement);
    expect(input).toBeTruthy();
  });

  it('não mostra botão Salvar quando o valor não foi alterado', async () => {
    render(<AutoGenerationPanel />);

    await waitFor(() => screen.getByDisplayValue('48'));
    expect(screen.queryByText('Salvar')).toBeNull();
  });

  it('salva o novo intervalo em site_settings quando o admin edita e clica Salvar', async () => {
    render(<AutoGenerationPanel />);

    const input = await waitFor(() => screen.getByDisplayValue('48') as HTMLInputElement);
    fireEvent.change(input, { target: { value: '72' } });

    const saveButton = await waitFor(() => screen.getByText('Salvar'));
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(upsertCalls).toContainEqual({ key: 'ai_auto_generate_interval_hours', value: '72' });
    });
  });

  it('rejeita valor inválido (0) sem chamar upsert', async () => {
    render(<AutoGenerationPanel />);

    const input = await waitFor(() => screen.getByDisplayValue('48') as HTMLInputElement);
    fireEvent.change(input, { target: { value: '0' } });

    const saveButton = await waitFor(() => screen.getByText('Salvar'));
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(upsertCalls.some((c: any) => c.key === 'ai_auto_generate_interval_hours')).toBe(false);
    });
  });

  it('rejeita valor acima de 720h sem chamar upsert', async () => {
    render(<AutoGenerationPanel />);

    const input = await waitFor(() => screen.getByDisplayValue('48') as HTMLInputElement);
    fireEvent.change(input, { target: { value: '9999' } });

    const saveButton = await waitFor(() => screen.getByText('Salvar'));
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(upsertCalls.some((c: any) => c.key === 'ai_auto_generate_interval_hours')).toBe(false);
    });
  });
});
