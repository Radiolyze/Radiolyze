import { useTranslation } from 'react-i18next';
import type { Patient, Study, QueueItem, Series } from '@/types/radiology';
import { PatientCard } from './PatientCard';
import { PriorStudiesTimeline } from './PriorStudiesTimeline';
import { SeriesList } from './SeriesList';
import { ReportQueue } from './ReportQueue';
import { Wifi, WifiOff } from 'lucide-react';

interface LeftSidebarProps {
  patient: Patient;
  study: Study;
  queueItems: QueueItem[];
  selectedQueueItemId: string | null;
  selectedSeriesId: string | null;
  onSelectQueueItem: (item: QueueItem) => void;
  onSelectSeries: (series: Series) => void;
  priorStudies?: Study[];
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
  priorStudies = [],
  wsConnected,
}: LeftSidebarProps) {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PatientCard patient={patient} study={study} />
      <PriorStudiesTimeline currentStudy={study} priorStudies={priorStudies} />
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
              <span className="text-success">{t('connection.liveUpdates')}</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{t('connection.connecting')}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
