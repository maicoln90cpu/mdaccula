import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Auth from '@/pages/Auth';
import { AuthProvider } from '@/hooks/useAuth';

// Create wrapper with all necessary providers
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Auth Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render login form by default', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <Auth />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
      });
    });

    it('should render email input', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <Auth />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
      });
    });

    it('should render password input', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <Auth />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/senha/i)).toBeInTheDocument();
      });
    });

    it('should render link to switch to signup', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <Auth />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/criar conta/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Switching', () => {
    it('should switch to signup form when clicking create account', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <Auth />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/criar conta/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/criar conta/i));

      await waitFor(() => {
        // Signup form should have a "Cadastrar" button
        expect(screen.getByRole('button', { name: /cadastrar/i })).toBeInTheDocument();
      });
    });

    it('should switch back to login form from signup', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <Auth />
        </Wrapper>
      );

      // First switch to signup
      await waitFor(() => {
        expect(screen.getByText(/criar conta/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/criar conta/i));

      await waitFor(() => {
        expect(screen.getByText(/já tem conta/i)).toBeInTheDocument();
      });

      // Then switch back to login
      fireEvent.click(screen.getByText(/já tem conta/i));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should not submit with empty email', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <Auth />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /entrar/i });
      fireEvent.click(submitButton);

      // Form should not submit without email
      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText(/email/i);
        expect(emailInput).toBeInvalid();
      });
    });

    it('should accept valid email format', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <Auth />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText(/email/i);
      await userEvent.type(emailInput, 'test@example.com');

      expect(emailInput).toHaveValue('test@example.com');
    });

    it('should accept password input', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <Auth />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/senha/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/senha/i);
      await userEvent.type(passwordInput, 'password123');

      expect(passwordInput).toHaveValue('password123');
    });
  });

  describe('Signup Form', () => {
    it('should render full name input in signup mode', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <Auth />
        </Wrapper>
      );

      // Switch to signup
      await waitFor(() => {
        expect(screen.getByText(/criar conta/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/criar conta/i));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/nome/i)).toBeInTheDocument();
      });
    });

    it('should render phone input in signup mode', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <Auth />
        </Wrapper>
      );

      // Switch to signup
      await waitFor(() => {
        expect(screen.getByText(/criar conta/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/criar conta/i));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/telefone/i)).toBeInTheDocument();
      });
    });
  });

  describe('UI Elements', () => {
    it('should render MDAccula branding', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <Auth />
        </Wrapper>
      );

      await waitFor(() => {
        // Check for logo or brand name
        const brandElements = screen.queryAllByRole('img');
        expect(brandElements.length).toBeGreaterThan(0);
      });
    });

    it('should have proper form structure', async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <Auth />
        </Wrapper>
      );

      await waitFor(() => {
        const form = screen.getByRole('form');
        expect(form).toBeInTheDocument();
      });
    });
  });
});
