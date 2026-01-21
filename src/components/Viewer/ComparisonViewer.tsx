import { useState, useCallback, useRef, useEffect } from 'react';
import { Columns2, X, ArrowLeftRight, Link2, Link2Off, ZoomIn, Move, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DicomViewer, type ViewerProgress } from './DicomViewer';
import type { Series, Study } from '@/types/radiology';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PriorStudy {
  study: Study;
  label: string;
  date: string;
}

interface ViewerState {
  zoom: number;
  pan: { x: number; y: number };
  windowLevel: { width: number; center: number };
}

interface SyncOptions {
  frames: boolean;
  zoom: boolean;
  pan: boolean;
  windowLevel: boolean;
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
  const [isSwapped, setIsSwapped] = useState(false);
  const [selectedPriorStudyId, setSelectedPriorStudyId] = useState<string | null>(null);
  const [selectedPriorSeriesId, setSelectedPriorSeriesId] = useState<string | null>(null);
  const [syncOptions, setSyncOptions] = useState<SyncOptions>({
    frames: true,
    zoom: false,
    pan: false,
    windowLevel: false,
  });
  const [currentFrame, setCurrentFrame] = useState(0);
  const [priorFrame, setPriorFrame] = useState(0);

  // Refs for viewport state synchronization
  const currentViewerStateRef = useRef<ViewerState | null>(null);
  const priorViewerStateRef = useRef<ViewerState | null>(null);
  const syncingRef = useRef(false);

  // Get selected prior study and series
  const selectedPriorStudy = priorStudies.find((p) => p.study.id === selectedPriorStudyId);
  const selectedPriorSeries = selectedPriorStudy?.study.series.find(
    (s) => s.id === selectedPriorSeriesId
  );

  const hasSyncEnabled = syncOptions.zoom || syncOptions.pan || syncOptions.windowLevel;

  // Toggle individual sync options
  const toggleSyncOption = useCallback((option: keyof SyncOptions) => {
    setSyncOptions((prev) => ({ ...prev, [option]: !prev[option] }));
  }, []);

  // Handle frame sync when linked
  const handleCurrentFrameChange = useCallback(
    (frame: number, total: number) => {
      setCurrentFrame(frame);
      if (syncOptions.frames && selectedPriorSeries) {
        // Sync prior frame proportionally
        const priorTotal = selectedPriorSeries.frameCount || 1;
        const syncedFrame = Math.round((frame / total) * priorTotal);
        setPriorFrame(Math.min(syncedFrame, priorTotal - 1));
      }
      onFrameChange?.(frame, total);
    },
    [syncOptions.frames, selectedPriorSeries, onFrameChange]
  );

  const handlePriorFrameChange = useCallback(
    (frame: number, total: number) => {
      setPriorFrame(frame);
      if (syncOptions.frames && currentSeries) {
        // Sync current frame proportionally
        const currentTotal = currentSeries.frameCount || 1;
        const syncedFrame = Math.round((frame / total) * currentTotal);
        setCurrentFrame(Math.min(syncedFrame, currentTotal - 1));
      }
    },
    [syncOptions.frames, currentSeries]
  );

  const handleEnableCompare = useCallback(() => {
    setIsCompareMode(true);
    setIsSwapped(false);
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
    setIsSwapped(false);
  }, []);

  const handleSwapViews = useCallback(() => {
    setIsSwapped((prev) => !prev);
  }, []);

  const handleSelectPriorStudy = useCallback(
    (studyId: string) => {
      setSelectedPriorStudyId(studyId);
      const study = priorStudies.find((p) => p.study.id === studyId);
      if (study && study.study.series.length > 0) {
        // Try to find matching series by description
        const currentDesc = currentSeries?.seriesDescription?.toLowerCase() || '';
        const matchingSeries = study.study.series.find(
          (s) =>
            s.seriesDescription?.toLowerCase().includes(currentDesc) ||
            currentDesc.includes(s.seriesDescription?.toLowerCase() || '')
        );
        setSelectedPriorSeriesId(matchingSeries?.id || study.study.series[0].id);
      }
    },
    [priorStudies, currentSeries]
  );

  // Determine which series goes where based on swap state
  const leftSeries = isSwapped ? selectedPriorSeries : currentSeries;
  const rightSeries = isSwapped ? currentSeries : selectedPriorSeries;
  const leftLabel = isSwapped ? selectedPriorStudy?.label : 'Aktuell';
  const rightLabel = isSwapped ? 'Aktuell' : selectedPriorStudy?.label;
  const leftDate = isSwapped ? selectedPriorStudy?.date : undefined;
  const rightDate = isSwapped ? undefined : selectedPriorStudy?.date;
  const leftProgress = isSwapped ? undefined : progress;
  const rightProgress = isSwapped ? progress : undefined;
  const leftFrameHandler = isSwapped ? handlePriorFrameChange : handleCurrentFrameChange;
  const rightFrameHandler = isSwapped ? handleCurrentFrameChange : handlePriorFrameChange;

  // Single viewer mode
  if (!isCompareMode) {
    return (
      <div className="h-full relative">
        <DicomViewer series={currentSeries} progress={progress} onFrameChange={onFrameChange} />

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
            <Select value={selectedPriorStudyId || ''} onValueChange={handleSelectPriorStudy}>
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
              <Select value={selectedPriorSeriesId || ''} onValueChange={setSelectedPriorSeriesId}>
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
          {/* Sync Options Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={hasSyncEnabled || syncOptions.frames ? 'default' : 'outline'}
                size="sm"
                className="gap-1"
              >
                {hasSyncEnabled || syncOptions.frames ? (
                  <Link2 className="h-4 w-4" />
                ) : (
                  <Link2Off className="h-4 w-4" />
                )}
                Sync
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Synchronisierung</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={syncOptions.frames}
                onCheckedChange={() => toggleSyncOption('frames')}
              >
                Frames synchronisieren
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={syncOptions.zoom}
                onCheckedChange={() => toggleSyncOption('zoom')}
              >
                <ZoomIn className="h-3.5 w-3.5 mr-2" />
                Zoom synchronisieren
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={syncOptions.pan}
                onCheckedChange={() => toggleSyncOption('pan')}
              >
                <Move className="h-3.5 w-3.5 mr-2" />
                Pan synchronisieren
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={syncOptions.windowLevel}
                onCheckedChange={() => toggleSyncOption('windowLevel')}
              >
                <Sun className="h-3.5 w-3.5 mr-2" />
                Fensterung synchronisieren
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Swap Views */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isSwapped ? 'default' : 'outline'}
                size="icon"
                className="h-8 w-8"
                onClick={handleSwapViews}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isSwapped ? 'Ansichten zurücktauschen' : 'Ansichten tauschen'}
            </TooltipContent>
          </Tooltip>

          {/* Exit Compare Mode */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDisableCompare}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Vergleichsmodus beenden</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Split View */}
      <div className="flex-1 flex relative">
        {/* Left Panel */}
        <div className="flex-1 relative border-r border-border">
          <div className="absolute top-2 left-2 z-20 flex items-center gap-2">
            <Badge
              className={cn(
                isSwapped
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-primary text-primary-foreground'
              )}
            >
              {leftLabel || 'Voruntersuchung'}
              {leftDate && <span className="ml-1 opacity-70">{leftDate}</span>}
            </Badge>
          </div>
          <DicomViewer
            series={leftSeries || null}
            progress={leftProgress}
            onFrameChange={leftFrameHandler}
          />
        </div>

        {/* Right Panel */}
        <div className="flex-1 relative">
          <div className="absolute top-2 left-2 z-20 flex items-center gap-2">
            <Badge
              className={cn(
                isSwapped
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              )}
            >
              {rightLabel || 'Voruntersuchung'}
              {rightDate && <span className="ml-1 opacity-70">{rightDate}</span>}
            </Badge>
          </div>

          {rightSeries ? (
            <DicomViewer
              series={rightSeries}
              progress={rightProgress}
              onFrameChange={rightFrameHandler}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-viewer">
              <div className="text-center text-muted-foreground">
                <Columns2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Wählen Sie eine Voruntersuchung</p>
              </div>
            </div>
          )}
        </div>

        {/* Sync Indicator */}
        {(syncOptions.frames || hasSyncEnabled) && selectedPriorSeries && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
            <Badge variant="outline" className="bg-card/90 backdrop-blur-sm gap-1">
              <Link2 className="h-3 w-3" />
              {[
                syncOptions.frames && 'Frames',
                syncOptions.zoom && 'Zoom',
                syncOptions.pan && 'Pan',
                syncOptions.windowLevel && 'WL',
              ]
                .filter(Boolean)
                .join(', ')}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
