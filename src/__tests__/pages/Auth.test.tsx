import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Auth from '@/pages/Auth';
import { AuthProvider } from '@/hooks/useAuth';

// Auth.tsx uses a Tabs pattern (Entrar / Cadastrar). Tests target tab triggers
// and inputs by label/id rather than guessing free text.

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const renderAuth = () => {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <Auth />
    </Wrapper>
  );
};

describe('Auth Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render Entrar tab by default', async () => {
      renderAuth();
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /entrar/i })).toBeInTheDocument();
      });
    });

    it('should render Cadastrar tab', async () => {
      renderAuth();
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /cadastrar/i })).toBeInTheDocument();
      });
    });

    it('should render email input on signin tab', async () => {
      renderAuth();
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/seu@email\.com/i)).toBeInTheDocument();
      });
    });

    it('should render password input on signin tab', async () => {
      const { container } = renderAuth();
      await waitFor(() => {
        expect(container.querySelector('#signin-password')).toBeTruthy();
      });
    });
  });

  describe('Tab switching', () => {
    it('should switch to signup form when clicking Cadastrar tab', async () => {
      const user = userEvent.setup();
      renderAuth();
      const tab = await screen.findByRole('tab', { name: /cadastrar/i });
      await user.click(tab);
      expect(await screen.findByPlaceholderText(/seu nome completo/i)).toBeInTheDocument();
    });

    it('should switch back to signin tab', async () => {
      const user = userEvent.setup();
      renderAuth();
      await user.click(await screen.findByRole('tab', { name: /cadastrar/i }));
      expect(await screen.findByPlaceholderText(/seu nome completo/i)).toBeInTheDocument();
      await user.click(screen.getByRole('tab', { name: /entrar/i }));
      expect(await screen.findByRole('button', { name: /^entrar$/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should accept valid email format', async () => {
      renderAuth();
      const emailInput = await screen.findByPlaceholderText(/seu@email\.com/i);
      await userEvent.type(emailInput, 'test@example.com');
      expect(emailInput).toHaveValue('test@example.com');
    });

    it('should accept password input', async () => {
      const { container } = renderAuth();
      await waitFor(() => expect(container.querySelector('#signin-password')).toBeTruthy());
      const passwordInput = container.querySelector('#signin-password') as HTMLInputElement;
      await userEvent.type(passwordInput, 'password123');
      expect(passwordInput.value).toBe('password123');
    });
  });

  describe('Signup Form', () => {
    it('should render full name input on signup tab', async () => {
      const user = userEvent.setup();
      renderAuth();
      await user.click(await screen.findByRole('tab', { name: /cadastrar/i }));
      expect(await screen.findByPlaceholderText(/seu nome completo/i)).toBeInTheDocument();
    });

    it('should render phone input on signup tab', async () => {
      const user = userEvent.setup();
      renderAuth();
      await user.click(await screen.findByRole('tab', { name: /cadastrar/i }));
      expect(await screen.findByPlaceholderText(/\(11\) 99999-9999/)).toBeInTheDocument();
    });
  });
});
