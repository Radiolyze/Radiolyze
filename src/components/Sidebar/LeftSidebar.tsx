import type { Patient, Study, QueueItem, Series } from '@/types/radiology';
import { PatientCard } from './PatientCard';
import { SeriesList } from './SeriesList';
import { ReportQueue } from './ReportQueue';

interface LeftSidebarProps {
  patient: Patient;
  study: Study;
  queueItems: QueueItem[];
  selectedQueueItemId: string | null;
  selectedSeriesId: string | null;
  onSelectQueueItem: (item: QueueItem) => void;
  onSelectSeries: (series: Series) => void;
}

export function LeftSidebar({
  patient,
  study,
  queueItems,
  selectedQueueItemId,
  selectedSeriesId,
  onSelectQueueItem,
  onSelectSeries,
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
    </div>
  );
}
