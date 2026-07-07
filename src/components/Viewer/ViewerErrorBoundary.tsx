import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import i18n from '@/i18n';
import { logger } from '@/lib/logger';

interface ViewerErrorBoundaryProps {
  children: ReactNode;
  /** Optional label shown in the fallback, e.g. "MPR", "3D Volume" */
  label?: string;
}

interface ViewerErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  /** Bumped on reload so children remount fresh instead of re-rendering the same crashed tree */
  resetKey: number;
}

const t = (key: string): string => i18n.t(key, { ns: 'errors' }) as string;

// Scoped boundary for a single viewer pane (Cornerstone/vtk.js), so a render
// crash there (WebGL context loss, malformed DICOM data, mesh failure) can't
// unmount the rest of the app - e.g. in-progress report text elsewhere on the page.
export class ViewerErrorBoundary extends Component<ViewerErrorBoundaryProps, ViewerErrorBoundaryState> {
  constructor(props: ViewerErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ViewerErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('[ViewerErrorBoundary] Caught error:', error);
    logger.error('[ViewerErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReload = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      resetKey: prev.resetKey + 1,
    }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-background/95 p-4">
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="font-medium">
                {this.props.label
                  ? `${t('viewerBoundary.title')} (${this.props.label})`
                  : t('viewerBoundary.title')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{t('viewerBoundary.message')}</p>
              {this.state.error && (
                <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                  {this.state.error.name}: {this.state.error.message}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={this.handleReload}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('viewerBoundary.reload')}
            </Button>
          </div>
        </div>
      );
    }

    return <div key={this.state.resetKey} className="contents">{this.props.children}</div>;
  }
}
