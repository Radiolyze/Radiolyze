import { useTranslation } from 'react-i18next';
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
  labelKey: string;
  className: string;
}> = {
  pending: {
    icon: Clock,
    labelKey: 'qa.pending',
    className: 'status-pending',
  },
  checking: {
    icon: Loader2,
    labelKey: 'qa.checking',
    className: 'bg-info/20 text-info border-info/30',
  },
  pass: {
    icon: CheckCircle,
    labelKey: 'qa.passed',
    className: 'status-pass',
  },
  warn: {
    icon: AlertTriangle,
    labelKey: 'qa.warnings',
    className: 'status-warn',
  },
  fail: {
    icon: XCircle,
    labelKey: 'qa.failed',
    className: 'status-fail',
  },
};

export function StatusBadge({ status, size = 'md', showLabel = true }: StatusBadgeProps) {
  const { t } = useTranslation('common');
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
      {showLabel && t(config.labelKey)}
    </Badge>
  );
}
