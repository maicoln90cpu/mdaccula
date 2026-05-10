import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Boom = () => {
  throw new Error("boom");
};

describe("ErrorBoundary", () => {
  it("renderiza children quando não há erro", () => {
    render(
      <ErrorBoundary>
        <div>conteudo ok</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("conteudo ok")).toBeInTheDocument();
  });

  it("captura erro e mostra fallback", () => {
    // Suprimir console.error esperado
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary pageName="Teste">
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Algo deu errado/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  it("usa fallback minimal quando minimal=true", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary pageName="Mini" minimal>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Erro ao carregar Mini/i)).toBeInTheDocument();
    spy.mockRestore();
  });
});
