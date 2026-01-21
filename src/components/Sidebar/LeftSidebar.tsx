import type { Patient, Study, QueueItem, Series } from '@/types/radiology';
import { PatientCard } from './PatientCard';
import { SeriesList } from './SeriesList';
import { ReportQueue } from './ReportQueue';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeftSidebarProps {
  patient: Patient;
  study: Study;
  queueItems: QueueItem[];
  selectedQueueItemId: string | null;
  selectedSeriesId: string | null;
  onSelectQueueItem: (item: QueueItem) => void;
  onSelectSeries: (series: Series) => void;
  wsConnected?: boolean;
}

export function LeftSidebar({
  patient,
  study,
  queueItems,
  selectedQueueItemId,
  selectedSeriesId,
  onSelectQueueItem,
  onSelectSeries,
  wsConnected,
}: LeftSidebarProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PatientCard patient={patient} study={study} />
      <SeriesList
        series={study.series}
        selectedSeriesId={selectedSeriesId}
        onSelectSeries={onSelectSeries}
      />
      <ReportQueue
        items={queueItems}
        selectedItemId={selectedQueueItemId}
        onSelectItem={onSelectQueueItem}
      />
      {/* WebSocket connection indicator */}
      {wsConnected !== undefined && (
        <div className="px-4 py-2 border-t border-sidebar-border flex items-center gap-2 text-xs">
          {wsConnected ? (
            <>
              <Wifi className="h-3 w-3 text-success" />
              <span className="text-success">Live-Updates aktiv</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Verbinden...</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
