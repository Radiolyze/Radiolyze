import { Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ViewerEmptyStateProps {
  title: string;
  subtitle?: string;
  variant?: 'full' | 'overlay';
  className?: string;
}

export function ViewerEmptyState({
  title,
  subtitle,
  variant = 'full',
  className,
}: ViewerEmptyStateProps) {
  const containerClassName =
    variant === 'overlay'
      ? 'absolute inset-0 flex items-center justify-center'
      : 'h-full flex items-center justify-center bg-viewer';

  return (
    <div className={cn(containerClassName, className)}>
      <div className="text-center text-muted-foreground">
        <Maximize2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{title}</p>
        {subtitle ? (
          <p className="text-xs text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
