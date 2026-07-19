/**
 * Fase A3 — Garante que `signOut` limpa o cache do TanStack Query,
 * evitando vazamento de dados entre sessões de usuários diferentes.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { waitFor } from '@testing-library/dom';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/hooks/useAuth';
import { useAuth } from '@/hooks/useAuthContext';
import { queryClient } from '@/lib/queryClient';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe('useAuth.signOut cache reset', () => {
  it('chama queryClient.clear() ao deslogar', async () => {
    const clearSpy = vi.spyOn(queryClient, 'clear');

    // Popular o cache para simular dados do usuário anterior
    queryClient.setQueryData(['events'], [{ id: 'x' }]);
    expect(queryClient.getQueryData(['events'])).toBeDefined();

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(clearSpy).toHaveBeenCalled();
    expect(queryClient.getQueryData(['events'])).toBeUndefined();

    clearSpy.mockRestore();
  });
});
