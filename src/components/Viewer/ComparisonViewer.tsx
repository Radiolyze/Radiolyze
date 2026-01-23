import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { SyncOptions, ViewportState } from '@/types/viewerSync';
import type { ImageRef, Series, Study } from '@/types/radiology';
import { useViewportSync } from '@/hooks/useViewportSync';
import type { ViewerProgress } from './DicomViewer';
import type { PriorStudy } from './comparisonTypes';
import { ComparisonToolbar } from './ComparisonToolbar';
import { ComparisonPane } from './ComparisonPane';
import { ComparisonSyncIndicator } from './ComparisonSyncIndicator';
import { ComparisonSingleView } from './ComparisonSingleView';

interface ComparisonViewerProps {
  currentSeries: Series | null;
  currentStudy?: Study;
  priorStudies?: PriorStudy[];
  progress?: ViewerProgress;
  onFrameChange?: (frame: number, total: number) => void;
  onImageRefsChange?: (refs: ImageRef[]) => void;
  evidenceSelection?: { seriesId: string; stackIndex: number } | null;
}

export function ComparisonViewer({
  currentSeries,
  priorStudies = [],
  progress,
  onFrameChange,
  onImageRefsChange,
  evidenceSelection,
}: ComparisonViewerProps) {
  const { t } = useTranslation('viewer');
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

  // Viewport sync state - what gets passed to the "other" viewer
  const [currentViewerSyncState, setCurrentViewerSyncState] = useState<Partial<ViewportState>>({});
  const [priorViewerSyncState, setPriorViewerSyncState] = useState<Partial<ViewportState>>({});

  const syncViewportChange = useViewportSync(syncOptions);

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

  // Handle viewport state changes from current viewer and sync to prior
  const handleCurrentViewportChange = useCallback(
    (state: Partial<ViewportState>) => {
      syncViewportChange(state, setPriorViewerSyncState);
    },
    [syncViewportChange]
  );

  // Handle viewport state changes from prior viewer and sync to current
  const handlePriorViewportChange = useCallback(
    (state: Partial<ViewportState>) => {
      syncViewportChange(state, setCurrentViewerSyncState);
    },
    [syncViewportChange]
  );

  const handleEnableCompare = useCallback(() => {
    setIsCompareMode(true);
    setIsSwapped(false);
    // Reset sync states
    setCurrentViewerSyncState({});
    setPriorViewerSyncState({});
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
    setCurrentViewerSyncState({});
    setPriorViewerSyncState({});
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
  const leftLabel = isSwapped ? selectedPriorStudy?.label : t('comparison.current');
  const rightLabel = isSwapped ? t('comparison.current') : selectedPriorStudy?.label;
  const leftDate = isSwapped ? selectedPriorStudy?.date : undefined;
  const rightDate = isSwapped ? undefined : selectedPriorStudy?.date;
  const leftProgress = isSwapped ? undefined : progress;
  const rightProgress = isSwapped ? progress : undefined;
  const leftFrameHandler = isSwapped ? handlePriorFrameChange : handleCurrentFrameChange;
  const rightFrameHandler = isSwapped ? handleCurrentFrameChange : handlePriorFrameChange;
  const leftViewportHandler = isSwapped ? handlePriorViewportChange : handleCurrentViewportChange;
  const rightViewportHandler = isSwapped ? handleCurrentViewportChange : handlePriorViewportChange;
  const leftSyncState = isSwapped ? currentViewerSyncState : priorViewerSyncState;
  const rightSyncState = isSwapped ? priorViewerSyncState : currentViewerSyncState;
  const leftEvidenceFrame =
    evidenceSelection && leftSeries?.id === evidenceSelection.seriesId
      ? evidenceSelection.stackIndex
      : null;
  const rightEvidenceFrame =
    evidenceSelection && rightSeries?.id === evidenceSelection.seriesId
      ? evidenceSelection.stackIndex
      : null;
  const leftImageRefsChange = !isSwapped ? onImageRefsChange : undefined;
  const rightImageRefsChange = isSwapped ? onImageRefsChange : undefined;
  const leftBadgeVariant = isSwapped ? 'secondary' : 'primary';
  const rightBadgeVariant = isSwapped ? 'primary' : 'secondary';
  const showSyncIndicator = Boolean(selectedPriorSeries) && (syncOptions.frames || hasSyncEnabled);

  // Single viewer mode
  if (!isCompareMode) {
    return (
      <ComparisonSingleView
        currentSeries={currentSeries}
        progress={progress}
        onFrameChange={onFrameChange}
        onImageRefsChange={onImageRefsChange}
        evidenceSelection={evidenceSelection}
        priorStudiesCount={priorStudies.length}
        onEnableCompare={handleEnableCompare}
      />
    );
  }

  // Split view comparison mode
  return (
    <div className="h-full flex flex-col">
      {/* Comparison Toolbar */}
      <ComparisonToolbar
        priorStudies={priorStudies}
        selectedPriorStudyId={selectedPriorStudyId}
        selectedPriorSeriesId={selectedPriorSeriesId}
        selectedPriorStudy={selectedPriorStudy}
        syncOptions={syncOptions}
        hasSyncEnabled={hasSyncEnabled}
        isSwapped={isSwapped}
        onSelectPriorStudy={handleSelectPriorStudy}
        onSelectPriorSeries={setSelectedPriorSeriesId}
        onToggleSyncOption={toggleSyncOption}
        onSwap={handleSwapViews}
        onDisable={handleDisableCompare}
      />

      {/* Split View */}
      <div className="flex-1 flex relative">
        {/* Left Panel */}
        <ComparisonPane
          className="border-r border-border"
          series={leftSeries || null}
          label={leftLabel || t('comparison.prior')}
          date={leftDate}
          badgeVariant={leftBadgeVariant}
          progress={leftProgress}
          onFrameChange={leftFrameHandler}
          onViewportChange={leftViewportHandler}
          syncState={leftSyncState}
          onImageRefsChange={leftImageRefsChange}
          requestedFrameIndex={leftEvidenceFrame}
          emptyMessage={t('comparison.noStudySelected')}
        />

        {/* Right Panel */}
        <ComparisonPane
          series={rightSeries || null}
          label={rightLabel || t('comparison.prior')}
          date={rightDate}
          badgeVariant={rightBadgeVariant}
          progress={rightProgress}
          onFrameChange={rightFrameHandler}
          onViewportChange={rightViewportHandler}
          syncState={rightSyncState}
          onImageRefsChange={rightImageRefsChange}
          requestedFrameIndex={rightEvidenceFrame}
          emptyMessage={t('comparison.noStudySelected')}
        />

        <ComparisonSyncIndicator isVisible={showSyncIndicator} syncOptions={syncOptions} />
      </div>
    </div>
  );
}
