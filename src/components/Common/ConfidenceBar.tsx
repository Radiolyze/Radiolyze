import { cn } from '@/lib/utils';

interface ConfidenceBarProps {
  value: number; // 0-1
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function ConfidenceBar({ 
  value, 
  label, 
  showPercentage = true, 
  size = 'md',
  className 
}: ConfidenceBarProps) {
  const percentage = Math.round(value * 100);
  
  const getColorClass = () => {
    if (value >= 0.9) return 'bg-confidence-high';
    if (value >= 0.7) return 'bg-confidence-medium';
    return 'bg-confidence-low';
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label && (
        <span className={cn(
          'text-muted-foreground shrink-0',
          size === 'sm' ? 'text-xs min-w-[60px]' : 'text-sm min-w-[80px]'
        )}>
          {label}
        </span>
      )}
      
      <div className={cn(
        'flex-1 bg-panel-secondary rounded-full overflow-hidden',
        size === 'sm' ? 'h-1.5' : 'h-2'
      )}>
        <div
          className={cn('h-full transition-all duration-500 ease-out rounded-full', getColorClass())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {showPercentage && (
        <span className={cn(
          'font-medium shrink-0 min-w-[36px] text-right',
          size === 'sm' ? 'text-xs' : 'text-sm'
        )}>
          {percentage}%
        </span>
      )}
    </div>
  );
}
