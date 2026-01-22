import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import i18n from '@/i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// Helper to get translations (class components can't use hooks)
const getTranslation = (key: string, ns: string = 'errors'): string => {
  return i18n.t(key, { ns }) as string;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    // Log error for debugging
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  handleClearStorage = (): void => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      alert(getTranslation('boundary.cacheClearedMessage'));
      window.location.reload();
    } catch (e) {
      console.error('Failed to clear storage:', e);
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error } = this.state;

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-destructive/50">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
              <CardTitle className="text-xl">{getTranslation('boundary.title')}</CardTitle>
              <CardDescription>
                {getTranslation('boundary.message')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="font-mono text-xs text-muted-foreground break-all">
                    {error.name}: {error.message}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="default"
                  onClick={this.handleReload}
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {getTranslation('boundary.actions.reload')}
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleReset}
                  className="w-full"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {getTranslation('boundary.actions.retry')}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  onClick={this.handleGoHome}
                  className="w-full"
                >
                  <Home className="mr-2 h-4 w-4" />
                  {getTranslation('boundary.actions.goHome')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={this.handleClearStorage}
                  className="w-full text-destructive hover:text-destructive"
                >
                  {getTranslation('boundary.actions.clearCache')}
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground pt-2">
                {getTranslation('generic.message')}
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
