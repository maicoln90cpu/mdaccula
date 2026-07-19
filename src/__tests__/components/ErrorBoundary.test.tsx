import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ErrorBoundary } from '@/components/ErrorBoundary';

const Boom = () => {
  throw new Error('boom');
};

describe('ErrorBoundary', () => {
  it('renderiza children quando não há erro', () => {
    render(
      <ErrorBoundary>
        <div>conteudo ok</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('conteudo ok')).toBeInTheDocument();
  });

  it('captura erro e mostra fallback', () => {
    // Suprimir console.error esperado
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary pageName="Teste">
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Algo deu errado/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  it('usa fallback minimal quando minimal=true', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary pageName="Mini" minimal>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Erro ao carregar Mini/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  describe('chunk obsoleto (auto-reload)', () => {
    const ChunkBoom = () => {
      throw new Error('Failed to fetch dynamically imported module: /assets/x.js');
    };
    let reloadSpy: ReturnType<typeof vi.fn>;
    let originalLocation: Location;

    beforeEach(() => {
      sessionStorage.clear();
      reloadSpy = vi.fn();
      originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...originalLocation, reload: reloadSpy },
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
      sessionStorage.clear();
    });

    it('dispara reload quando erro é de chunk obsoleto', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <ErrorBoundary pageName="Chunk">
          <ChunkBoom />
        </ErrorBoundary>
      );
      expect(reloadSpy).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem('__chunk_reload_at')).toBeTruthy();
      spy.mockRestore();
      warn.mockRestore();
    });

    it('NÃO recarrega duas vezes dentro de 10s (guarda anti-loop)', () => {
      sessionStorage.setItem('__chunk_reload_at', String(Date.now()));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(
        <ErrorBoundary pageName="Chunk">
          <ChunkBoom />
        </ErrorBoundary>
      );
      expect(reloadSpy).not.toHaveBeenCalled();
      // Como não recarregou, mostra a tela de erro padrão
      expect(screen.getByText(/Algo deu errado/i)).toBeInTheDocument();
      spy.mockRestore();
    });

    it('erro comum NÃO dispara reload e mostra fallback', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(
        <ErrorBoundary pageName="Normal">
          <Boom />
        </ErrorBoundary>
      );
      expect(reloadSpy).not.toHaveBeenCalled();
      expect(screen.getByText(/Algo deu errado/i)).toBeInTheDocument();
      spy.mockRestore();
    });
  });
});
