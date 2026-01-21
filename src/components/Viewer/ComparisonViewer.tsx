import { useState, useCallback } from 'react';
import { Columns2, X, Maximize2, ArrowLeftRight, Link2, Link2Off } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DicomViewer, type ViewerProgress } from './DicomViewer';
import type { Series, Study } from '@/types/radiology';
import { cn } from '@/lib/utils';

interface PriorStudy {
  study: Study;
  label: string;
  date: string;
}

interface ComparisonViewerProps {
  currentSeries: Series | null;
  currentStudy?: Study;
  priorStudies?: PriorStudy[];
  progress?: ViewerProgress;
  onFrameChange?: (frame: number, total: number) => void;
}

export function ComparisonViewer({
  currentSeries,
  currentStudy,
  priorStudies = [],
  progress,
  onFrameChange,
}: ComparisonViewerProps) {
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedPriorStudyId, setSelectedPriorStudyId] = useState<string | null>(null);
  const [selectedPriorSeriesId, setSelectedPriorSeriesId] = useState<string | null>(null);
  const [isLinked, setIsLinked] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [priorFrame, setPriorFrame] = useState(0);

  // Get selected prior study and series
  const selectedPriorStudy = priorStudies.find((p) => p.study.id === selectedPriorStudyId);
  const selectedPriorSeries = selectedPriorStudy?.study.series.find(
    (s) => s.id === selectedPriorSeriesId
  );

  // Handle frame sync when linked
  const handleCurrentFrameChange = useCallback(
    (frame: number, total: number) => {
      setCurrentFrame(frame);
      if (isLinked && selectedPriorSeries) {
        // Sync prior frame proportionally
        const priorTotal = selectedPriorSeries.frameCount || 1;
        const syncedFrame = Math.round((frame / total) * priorTotal);
        setPriorFrame(Math.min(syncedFrame, priorTotal - 1));
      }
      onFrameChange?.(frame, total);
    },
    [isLinked, selectedPriorSeries, onFrameChange]
  );

  const handlePriorFrameChange = useCallback(
    (frame: number, total: number) => {
      setPriorFrame(frame);
      if (isLinked && currentSeries) {
        // Sync current frame proportionally
        const currentTotal = currentSeries.frameCount || 1;
        const syncedFrame = Math.round((frame / total) * currentTotal);
        setCurrentFrame(Math.min(syncedFrame, currentTotal - 1));
      }
    },
    [isLinked, currentSeries]
  );

  const handleEnableCompare = useCallback(() => {
    setIsCompareMode(true);
    // Auto-select first prior study and series if available
    if (priorStudies.length > 0 && !selectedPriorStudyId) {
      const firstPrior = priorStudies[0];
      setSelectedPriorStudyId(firstPrior.study.id);
      if (firstPrior.study.series.length > 0) {
        setSelectedPriorSeriesId(firstPrior.study.series[0].id);
      }
    }
  }, [priorStudies, selectedPriorStudyId]);

  const handleDisableCompare = useCallback(() => {
    setIsCompareMode(false);
  }, []);

  const handleSelectPriorStudy = useCallback(
    (studyId: string) => {
      setSelectedPriorStudyId(studyId);
      const study = priorStudies.find((p) => p.study.id === studyId);
      if (study && study.study.series.length > 0) {
        // Try to find matching series by description
        const currentDesc = currentSeries?.seriesDescription?.toLowerCase() || '';
        const matchingSeries = study.study.series.find(
          (s) => s.seriesDescription?.toLowerCase().includes(currentDesc) ||
                 currentDesc.includes(s.seriesDescription?.toLowerCase() || '')
        );
        setSelectedPriorSeriesId(matchingSeries?.id || study.study.series[0].id);
      }
    },
    [priorStudies, currentSeries]
  );

  // Single viewer mode
  if (!isCompareMode) {
    return (
      <div className="h-full relative">
        <DicomViewer
          series={currentSeries}
          progress={progress}
          onFrameChange={onFrameChange}
        />
        
        {/* Compare Mode Toggle */}
        {priorStudies.length > 0 && currentSeries && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnableCompare}
              className="bg-card/90 backdrop-blur-sm"
            >
              <Columns2 className="h-4 w-4 mr-2" />
              Vergleich mit Voruntersuchung
              <Badge variant="secondary" className="ml-2">
                {priorStudies.length}
              </Badge>
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Split view comparison mode
  return (
    <div className="h-full flex flex-col">
      {/* Comparison Toolbar */}
      <div className="h-12 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-primary border-primary">
            <Columns2 className="h-3 w-3 mr-1" />
            Vergleichsmodus
          </Badge>
          
          {/* Prior Study Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Voruntersuchung:</span>
            <Select
              value={selectedPriorStudyId || ''}
              onValueChange={handleSelectPriorStudy}
            >
              <SelectTrigger className="h-8 w-[200px]">
                <SelectValue placeholder="Studie wählen" />
              </SelectTrigger>
              <SelectContent>
                {priorStudies.map((prior) => (
                  <SelectItem key={prior.study.id} value={prior.study.id}>
                    {prior.label} ({prior.date})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Prior Series Selector */}
            {selectedPriorStudy && (
              <Select
                value={selectedPriorSeriesId || ''}
                onValueChange={setSelectedPriorSeriesId}
              >
                <SelectTrigger className="h-8 w-[150px]">
                  <SelectValue placeholder="Serie wählen" />
                </SelectTrigger>
                <SelectContent>
                  {selectedPriorStudy.study.series.map((series) => (
                    <SelectItem key={series.id} value={series.id}>
                      {series.seriesDescription}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Link/Unlink Toggle */}
          <Button
            variant={isLinked ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsLinked(!isLinked)}
            title={isLinked ? 'Synchronisation aufheben' : 'Frames synchronisieren'}
          >
            {isLinked ? (
              <>
                <Link2 className="h-4 w-4 mr-1" />
                Synchron
              </>
            ) : (
              <>
                <Link2Off className="h-4 w-4 mr-1" />
                Unabhängig
              </>
            )}
          </Button>
          
          {/* Swap Views */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            title="Ansichten tauschen"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
          
          {/* Exit Compare Mode */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDisableCompare}
            title="Vergleichsmodus beenden"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Split View */}
      <div className="flex-1 flex">
        {/* Current Study (Left) */}
        <div className="flex-1 relative border-r border-border">
          <div className="absolute top-2 left-2 z-20">
            <Badge className="bg-primary text-primary-foreground">
              Aktuell
            </Badge>
          </div>
          <DicomViewer
            series={currentSeries}
            progress={progress}
            onFrameChange={handleCurrentFrameChange}
          />
        </div>
        
        {/* Prior Study (Right) */}
        <div className="flex-1 relative">
          <div className="absolute top-2 left-2 z-20">
            <Badge variant="secondary">
              {selectedPriorStudy?.label || 'Voruntersuchung'}
              {selectedPriorStudy && (
                <span className="ml-1 opacity-70">
                  {selectedPriorStudy.date}
                </span>
              )}
            </Badge>
          </div>
          
          {selectedPriorSeries ? (
            <DicomViewer
              series={selectedPriorSeries}
              onFrameChange={handlePriorFrameChange}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-viewer">
              <div className="text-center text-muted-foreground">
                <Maximize2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Wählen Sie eine Voruntersuchung</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Sync Indicator */}
      {isLinked && selectedPriorSeries && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20">
          <Badge variant="outline" className="bg-card/90 backdrop-blur-sm">
            <Link2 className="h-3 w-3 mr-1" />
            Frames synchronisiert
          </Badge>
        </div>
      )}
    </div>
  );
}