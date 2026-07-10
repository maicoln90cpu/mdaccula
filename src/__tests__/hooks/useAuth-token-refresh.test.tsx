import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { waitFor } from '@testing-library/dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

/**
 * Regressão: quando o Supabase dispara TOKEN_REFRESHED com o MESMO user id
 * (ex.: usuário voltou de outra aba do navegador), o objeto `user` do contexto
 * NÃO deve trocar de referência — do contrário, componentes filhos remontam
 * e perdem estado local (foi o bug do EmailConfig resetando a aba ativa).
 */
describe('useAuth — estabilidade em TOKEN_REFRESHED', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mantém a mesma referência de `user` quando a sessão é apenas renovada', async () => {
    const sessionA = {
      access_token: 'tok-1',
      refresh_token: 'ref-1',
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: 'user-123', email: 'x@y.z' },
    };
    const sessionB = {
      ...sessionA,
      access_token: 'tok-2', // novo token, mesmo user id
      user: { id: 'user-123', email: 'x@y.z' },
    };

    let capturedCallback:
      | ((event: string, session: unknown) => void)
      | null = null;
    (supabase.auth.onAuthStateChange as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        capturedCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }
    );
    (supabase.auth.getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { session: sessionA },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user?.id).toBe('user-123');
    });
    const userRefBefore = result.current.user;

    // Simula TOKEN_REFRESHED do Supabase com o mesmo user id
    await act(async () => {
      capturedCallback?.('TOKEN_REFRESHED', sessionB);
    });

    expect(result.current.user).toBe(userRefBefore);
    expect(result.current.user?.id).toBe('user-123');
  });
});
