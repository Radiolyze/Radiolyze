import { Layers, Image } from 'lucide-react';
import type { Series } from '@/types/radiology';
import { cn } from '@/lib/utils';

interface SeriesListProps {
  series: Series[];
  selectedSeriesId: string | null;
  onSelectSeries: (series: Series) => void;
}

export function SeriesList({ series, selectedSeriesId, onSelectSeries }: SeriesListProps) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground">
          <Layers className="h-4 w-4" />
          <span>Serien ({series.length})</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {series.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelectSeries(s)}
            className={cn(
              'w-full p-3 rounded-lg text-left transition-colors',
              'hover:bg-sidebar-accent',
              'focus:outline-none focus:ring-2 focus:ring-sidebar-ring',
              selectedSeriesId === s.id
                ? 'bg-sidebar-accent border border-primary/50'
                : 'bg-transparent'
            )}
          >
            <div className="flex items-start gap-3">
              {/* Thumbnail placeholder */}
              <div className="w-12 h-12 bg-panel-secondary rounded flex items-center justify-center shrink-0">
                <Image className="h-6 w-6 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {s.seriesDescription}
                </p>
                <p className="text-xs text-muted-foreground">
                  Serie {s.seriesNumber} • {s.modality}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.frameCount} Bilder
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
