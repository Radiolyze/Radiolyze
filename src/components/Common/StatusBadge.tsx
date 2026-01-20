import { CheckCircle, AlertTriangle, XCircle, Loader2, Clock } from 'lucide-react';
import type { QAStatus } from '@/types/radiology';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: QAStatus;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const statusConfig: Record<QAStatus, {
  icon: typeof CheckCircle;
  label: string;
  className: string;
}> = {
  pending: {
    icon: Clock,
    label: 'Ausstehend',
    className: 'status-pending',
  },
  checking: {
    icon: Loader2,
    label: 'Prüfung...',
    className: 'bg-info/20 text-info border-info/30',
  },
  pass: {
    icon: CheckCircle,
    label: 'Bestanden',
    className: 'status-pass',
  },
  warn: {
    icon: AlertTriangle,
    label: 'Warnungen',
    className: 'status-warn',
  },
  fail: {
    icon: XCircle,
    label: 'Fehler',
    className: 'status-fail',
  },
};

export function StatusBadge({ status, size = 'md', showLabel = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        config.className,
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
      )}
    >
      <Icon className={cn(
        'mr-1.5',
        size === 'sm' ? 'h-3 w-3' : 'h-4 w-4',
        status === 'checking' && 'animate-spin'
      )} />
      {showLabel && config.label}
    </Badge>
  );
}
