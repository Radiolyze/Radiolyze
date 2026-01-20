import { FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import type { QueueItem } from '@/types/radiology';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatTime } from '@/data/mockData';

interface ReportQueueProps {
  items: QueueItem[];
  selectedItemId: string | null;
  onSelectItem: (item: QueueItem) => void;
}

const statusConfig = {
  pending: {
    icon: Clock,
    label: 'Ausstehend',
    className: 'bg-muted text-muted-foreground',
  },
  in_progress: {
    icon: FileText,
    label: 'In Bearbeitung',
    className: 'bg-info/20 text-info',
  },
  draft: {
    icon: FileText,
    label: 'Entwurf',
    className: 'bg-warning/20 text-warning',
  },
  approved: {
    icon: CheckCircle,
    label: 'Genehmigt',
    className: 'bg-success/20 text-success',
  },
  finalized: {
    icon: CheckCircle,
    label: 'Abgeschlossen',
    className: 'bg-success/20 text-success',
  },
};

const priorityConfig = {
  normal: null,
  urgent: { label: 'Dringend', className: 'bg-warning/20 text-warning border-warning/30' },
  stat: { label: 'STAT', className: 'bg-destructive/20 text-destructive border-destructive/30' },
};

export function ReportQueue({ items, selectedItemId, onSelectItem }: ReportQueueProps) {
  const pendingCount = items.filter(i => i.report.status === 'pending' || i.report.status === 'in_progress').length;

  return (
    <div className="flex flex-col border-t border-sidebar-border">
      <div className="px-4 py-3 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground">
          <FileText className="h-4 w-4" />
          <span>Warteschlange</span>
        </div>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="bg-primary/20 text-primary">
            {pendingCount}
          </Badge>
        )}
      </div>

      <div className="overflow-y-auto max-h-48 p-2 space-y-1">
        {items.map((item) => {
          const status = statusConfig[item.report.status];
          const priority = priorityConfig[item.priority];
          const StatusIcon = status.icon;

          return (
            <button
              key={item.id}
              onClick={() => onSelectItem(item)}
              className={cn(
                'w-full p-2 rounded-lg text-left transition-colors',
                'hover:bg-sidebar-accent',
                'focus:outline-none focus:ring-2 focus:ring-sidebar-ring',
                selectedItemId === item.id
                  ? 'bg-sidebar-accent border border-primary/50'
                  : 'bg-transparent'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {item.patient.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.study.studyDescription}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', status.className)}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {status.label}
                  </Badge>
                  {priority && (
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', priority.className)}>
                      {priority.label}
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {formatTime(item.report.createdAt)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
