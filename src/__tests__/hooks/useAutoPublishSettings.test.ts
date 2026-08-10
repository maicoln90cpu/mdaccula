import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const fromMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { useAutoPublishSettings } from '@/hooks/useAutoPublishSettings';

function mockSelectRows(rows: { key: string; value: string }[]) {
  fromMock.mockImplementation(() => ({
    select: () => ({
      in: () => Promise.resolve({ data: rows, error: null }),
    }),
    upsert: () => Promise.resolve({ error: null }),
  }));
}

describe('useAutoPublishSettings', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('converte value "true"/"false" (string) em boolean por chave', async () => {
    mockSelectRows([
      { key: 'auto_publish_generate_tab', value: 'true' },
      { key: 'auto_publish_topic_search', value: 'false' },
    ]);
    const { result } = renderHook(() =>
      useAutoPublishSettings(['auto_publish_generate_tab', 'auto_publish_topic_search'])
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings.auto_publish_generate_tab).toBe(true);
    expect(result.current.settings.auto_publish_topic_search).toBe(false);
  });

  it('chave ausente no banco fica undefined (não quebra, trata como falsy)', async () => {
    mockSelectRows([]);
    const { result } = renderHook(() => useAutoPublishSettings(['auto_publish_multi_event']));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings.auto_publish_multi_event).toBeUndefined();
  });

  it('updateSetting faz upsert e atualiza o estado local otimisticamente', async () => {
    mockSelectRows([{ key: 'auto_publish_single_event', value: 'false' }]);
    const { result } = renderHook(() => useAutoPublishSettings(['auto_publish_single_event']));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings.auto_publish_single_event).toBe(false);

    await act(async () => {
      await result.current.updateSetting('auto_publish_single_event', true);
    });
    expect(result.current.settings.auto_publish_single_event).toBe(true);
  });
});
