import type { ReactNode } from 'react';
import React, { Component } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { AlertCircle, RefreshCw, ArrowLeft, Home } from 'lucide-react';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Optional: Name of the page/section for better error tracking */
  pageName?: string;
  /** Optional: Show a minimal fallback instead of the full card */
  minimal?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  private errorLogger = logger.scope({ component: 'ErrorBoundary' });

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Detecta chunk obsoleto (após novo deploy) e tenta recarregar uma vez
    const msg = String(error?.message || "");
    const isChunkError =
      msg.includes("dynamically imported module") ||
      msg.includes("Failed to fetch dynamically imported") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("error loading dynamically imported module");

    if (isChunkError) {
      try {
        const KEY = "__chunk_reload_at";
        const last = Number(sessionStorage.getItem(KEY) || "0");
        if (Date.now() - last >= 10_000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          // eslint-disable-next-line no-console
          console.warn("[ErrorBoundary] Chunk obsoleto detectado — recarregando.");
          window.location.reload();
          return;
        }
      } catch {
        window.location.reload();
        return;
      }
    }

    // Log error with centralized logger
    this.errorLogger.error(
      `Uncaught error in ${this.props.pageName || 'component tree'}`,
      error,
      { 
        action: 'componentDidCatch',
        pageName: this.props.pageName,
        componentStack: errorInfo.componentStack?.slice(0, 500) 
      }
    );

    // Store error info for display
    this.setState({ errorInfo });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleReload = () => {
    this.errorLogger.info('User triggered page reload');
    window.location.reload();
  };

  handleGoBack = () => {
    this.errorLogger.info('User navigated back');
    window.history.back();
  };

  handleGoHome = () => {
    this.errorLogger.info('User navigated to home');
    window.location.href = '/';
  };

  handleRetry = () => {
    this.errorLogger.info('User triggered error retry');
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = import.meta.env.DEV;

      // Minimal fallback for sections/components
      if (this.props.minimal) {
        return (
          <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5 text-center">
            <AlertCircle className="w-6 h-6 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Erro ao carregar {this.props.pageName || 'este conteúdo'}
            </p>
            <Button onClick={this.handleRetry} size="sm" variant="outline">
              <RefreshCw className="w-3 h-3 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full border-destructive/20">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl">Algo deu errado</CardTitle>
              <CardDescription className="text-base">
                {this.props.pageName 
                  ? `Ocorreu um erro ao carregar ${this.props.pageName}. Tente recarregar a página.`
                  : 'Ocorreu um erro inesperado. Tente recarregar a página ou voltar para a página inicial.'}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Error details in development */}
              {isDev && this.state.error && (
                <div className="p-4 bg-muted rounded-lg border border-border overflow-auto max-h-48">
                  <p className="text-sm font-medium text-destructive mb-2">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {this.state.error.stack.slice(0, 800)}
                    </pre>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={this.handleRetry}
                  variant="default"
                  className="col-span-2"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar Novamente
                </Button>
                
                <Button 
                  onClick={this.handleGoBack}
                  variant="outline"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
                
                <Button 
                  onClick={this.handleGoHome}
                  variant="outline"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Página Inicial
                </Button>
              </div>

              {/* Help text */}
              <p className="text-xs text-muted-foreground text-center">
                Se o problema persistir, entre em contato conosco através da página de{' '}
                <a href="/contato" className="text-primary hover:underline">Contato</a>.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a page component with ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  pageName?: string,
  minimal?: boolean
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary pageName={pageName} minimal={minimal}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

/**
 * Hook-friendly wrapper component for sections
 */
export function SectionErrorBoundary({ 
  children, 
  name 
}: { 
  children: ReactNode; 
  name: string;
}) {
  return (
    <ErrorBoundary pageName={name} minimal>
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
