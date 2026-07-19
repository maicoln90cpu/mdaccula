import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock useAuth antes de importar ProtectedRoute
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

import ProtectedRoute from '@/components/ProtectedRoute';

const renderWithRouter = () =>
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <div>conteudo admin</div>
            </ProtectedRoute>
          }
        />
        <Route path="/auth" element={<div>tela de login</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('ProtectedRoute', () => {
  it('mostra spinner enquanto loading=true', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAdmin: false,
      isAdminLoading: false,
      loading: true,
    });
    renderWithRouter();
    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
  });

  it('redireciona para /auth quando sem usuário', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAdmin: false,
      isAdminLoading: false,
      loading: false,
    });
    renderWithRouter();
    expect(screen.getByText('tela de login')).toBeInTheDocument();
  });

  it('bloqueia user logado sem isAdmin', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'x' },
      isAdmin: false,
      isAdminLoading: false,
      loading: false,
    });
    renderWithRouter();
    expect(screen.getByText(/Acesso Negado/i)).toBeInTheDocument();
    expect(screen.queryByText('conteudo admin')).not.toBeInTheDocument();
  });

  it('renderiza children quando isAdmin=true', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'x' },
      isAdmin: true,
      isAdminLoading: false,
      loading: false,
    });
    renderWithRouter();
    expect(screen.getByText('conteudo admin')).toBeInTheDocument();
  });

  it('mostra spinner (não Acesso Negado) enquanto isAdminLoading=true mesmo com user logado', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'x' },
      isAdmin: false,
      isAdminLoading: true,
      loading: false,
    });
    renderWithRouter();
    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
    expect(screen.queryByText(/Acesso Negado/i)).not.toBeInTheDocument();
  });
});
