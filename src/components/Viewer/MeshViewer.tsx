import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Scissors,
  UploadCloud,
} from 'lucide-react';
import type { Series } from '@/types/radiology';
import type {
  LabelDisplayState,
  SegmentationLabel,
  SegmentationManifest,
  SegmentationPreset,
} from '@/types/segmentation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useSegmentation } from '@/hooks/useSegmentation';
import { useMeshScene } from '@/hooks/useMeshScene';
import { useLabelColors } from '@/hooks/useLabelColors';
import { segmentationClient } from '@/services/segmentationClient';
import { ViewerEmptyState } from './ViewerEmptyState';
import { MeshNotForDiagnosticBanner } from './MeshNotForDiagnosticBanner';
import { MeshColorPicker } from './MeshColorPicker';

interface MeshViewerProps {
  series: Series | null;
  studyUid?: string | null;
  className?: string;
}

const DEFAULT_PRESET: SegmentationPreset = 'bone';
const PREFETCH_TOP_N = 10;
type SortMode = 'volume' | 'name';

function defaultLabelState(
  label: SegmentationLabel,
  options: { visible: boolean },
): LabelDisplayState {
  return {
    visible: options.visible,
    opacity: 1,
    color: label.color,
  };
}

function topByVolume(labels: SegmentationLabel[], n: number): Set<number> {
  return new Set(
    [...labels]
      .sort((a, b) => b.volume_ml - a.volume_ml)
      .slice(0, n)
      .map((label) => label.id),
  );
}

export function MeshViewer({ series, studyUid, className }: MeshViewerProps) {
  const { t } = useTranslation('viewer');
  const { jobId, status, isStarting, start, error } = useSegmentation();
  const {
    containerRef,
    loadVtp,
    setVisibility,
    setOpacity,
    setColor,
    resetCamera,
    isReady,
    enableClipPlane,
    setClipPlanePosition,
    getClipPlaneRange,
  } = useMeshScene();
  const labelColors = useLabelColors();

  const [preset, setPreset] = useState<SegmentationPreset>(DEFAULT_PRESET);
  const [labelStates, setLabelStates] = useState<Record<number, LabelDisplayState>>({});
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('volume');
  const [minVolumeMl, setMinVolumeMl] = useState(0);
  const [labelErrors, setLabelErrors] = useState<Record<number, string>>({});
  const [clipEnabled, setClipEnabled] = useState(false);
  const [clipAxis, setClipAxis] = useState<'x' | 'y' | 'z'>('z');
  const [clipPosition, setClipPosition] = useState<number | null>(null);
  const [pushState, setPushState] = useState<
    { phase: 'idle' } | { phase: 'pushing' } | { phase: 'pushed'; url: string } | { phase: 'failed'; error: string }
  >({ phase: 'idle' });
  const loadedLabelsRef = useRef<Set<number>>(new Set());
  const hydratedManifestRef = useRef<string | null>(null);

  const manifest: SegmentationManifest | null = status?.manifest ?? null;
  const totalLabelCount = manifest?.labels.length ?? 0;
  const isLargeManifest = totalLabelCount > 20;

  const fetchAndLoadLabel = useCallback(
    async (label: SegmentationLabel) => {
      if (!jobId || loadedLabelsRef.current.has(label.id)) return;
      loadedLabelsRef.current.add(label.id);
      setLabelErrors((current) => {
        if (!(label.id in current)) return current;
        const { [label.id]: _, ...rest } = current;
        return rest;
      });
      try {
        const buffer = await segmentationClient.fetchMesh(jobId, label.id, 'vtp');
        loadVtp(label.id, buffer);
        const effective = labelColors.getOverride(label.name) ?? label.color;
        setColor(label.id, effective);
      } catch (err) {
        loadedLabelsRef.current.delete(label.id);
        const message = err instanceof Error ? err.message : String(err);
        setLabelErrors((current) => ({ ...current, [label.id]: message }));
        console.error(`Failed to load mesh ${label.id}`, err);
      }
    },
    [jobId, loadVtp, setColor, labelColors],
  );

  const retryLabel = useCallback(
    (label: SegmentationLabel) => {
      loadedLabelsRef.current.delete(label.id);
      setLabelErrors((current) => {
        if (!(label.id in current)) return current;
        const { [label.id]: _, ...rest } = current;
        return rest;
      });
      void fetchAndLoadLabel(label);
    },
    [fetchAndLoadLabel],
  );

  // Hydrate label state once per manifest (re-runs when a fresh job lands).
  useEffect(() => {
    if (!manifest || !isReady) return;
    if (hydratedManifestRef.current === manifest.job_id) return;
    hydratedManifestRef.current = manifest.job_id;

    const initialVisible = isLargeManifest
      ? topByVolume(manifest.labels, PREFETCH_TOP_N)
      : new Set(manifest.labels.map((label) => label.id));

    const next: Record<number, LabelDisplayState> = {};
    manifest.labels.forEach((label) => {
      const baseState = defaultLabelState(label, {
        visible: initialVisible.has(label.id),
      });
      const persisted = labelColors.getOverride(label.name);
      next[label.id] = persisted ? { ...baseState, color: persisted } : baseState;
    });
    setLabelStates(next);

    // Prefetch only the initially visible labels. Everything else loads
    // on-demand when the user toggles it on.
    manifest.labels
      .filter((label) => initialVisible.has(label.id))
      .forEach((label) => {
        void fetchAndLoadLabel(label);
      });
    // labelColors only feeds the initial hydration; subsequent overrides flow
    // through onColorChange directly, so re-running this effect on color
    // changes would rewrite labelStates and erase user toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, isReady, isLargeManifest, fetchAndLoadLabel]);

  const handleStart = useCallback(async () => {
    if (!series || !studyUid) return;
    loadedLabelsRef.current.clear();
    setLabelStates({});
    setLabelErrors({});
    hydratedManifestRef.current = null;
    setSearch('');
    setMinVolumeMl(0);
    setClipEnabled(false);
    setClipPosition(null);
    setPushState({ phase: 'idle' });
    enableClipPlane(false);
    await start({
      studyUid,
      seriesUid: series.id,
      preset,
    });
  }, [series, studyUid, preset, start, enableClipPlane]);

  const onClipToggle = useCallback(
    (enabled: boolean) => {
      setClipEnabled(enabled);
      enableClipPlane(enabled, clipAxis);
      if (enabled) {
        const range = getClipPlaneRange(clipAxis);
        if (range) {
          const mid = (range[0] + range[1]) / 2;
          setClipPosition(mid);
        }
      } else {
        setClipPosition(null);
      }
    },
    [enableClipPlane, getClipPlaneRange, clipAxis],
  );

  const onClipAxisChange = useCallback(
    (axis: 'x' | 'y' | 'z') => {
      setClipAxis(axis);
      if (clipEnabled) {
        enableClipPlane(true, axis);
        const range = getClipPlaneRange(axis);
        if (range) {
          const mid = (range[0] + range[1]) / 2;
          setClipPosition(mid);
        }
      }
    },
    [clipEnabled, enableClipPlane, getClipPlaneRange],
  );

  const onClipPositionChange = useCallback(
    (value: number) => {
      setClipPosition(value);
      setClipPlanePosition(value);
    },
    [setClipPlanePosition],
  );

  const handlePushToPacs = useCallback(async () => {
    if (!jobId) return;
    setPushState({ phase: 'pushing' });
    try {
      const response = await segmentationClient.pushToPacs(jobId);
      setPushState({ phase: 'pushed', url: response.dicom_seg_orthanc_url });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPushState({ phase: 'failed', error: message });
    }
  }, [jobId]);

  const onToggle = useCallback(
    (label: SegmentationLabel, checked: boolean) => {
      setLabelStates((current) => ({
        ...current,
        [label.id]: {
          ...(current[label.id] ?? defaultLabelState(label, { visible: checked })),
          visible: checked,
        },
      }));
      if (checked) {
        void fetchAndLoadLabel(label);
        setVisibility(label.id, true);
      } else {
        setVisibility(label.id, false);
      }
    },
    [fetchAndLoadLabel, setVisibility],
  );

  const onOpacity = useCallback(
    (label: SegmentationLabel, value: number) => {
      setLabelStates((current) => ({
        ...current,
        [label.id]: {
          ...(current[label.id] ?? defaultLabelState(label, { visible: true })),
          opacity: value,
        },
      }));
      setOpacity(label.id, value);
    },
    [setOpacity],
  );

  const onColorChange = useCallback(
    (label: SegmentationLabel, rgb: [number, number, number]) => {
      setLabelStates((current) => ({
        ...current,
        [label.id]: {
          ...(current[label.id] ?? defaultLabelState(label, { visible: true })),
          color: rgb,
        },
      }));
      setColor(label.id, rgb);
      labelColors.override(label.name, rgb);
    },
    [setColor, labelColors],
  );

  const onColorReset = useCallback(
    (label: SegmentationLabel) => {
      labelColors.reset(label.name);
      setLabelStates((current) => ({
        ...current,
        [label.id]: {
          ...(current[label.id] ?? defaultLabelState(label, { visible: true })),
          color: label.color,
        },
      }));
      setColor(label.id, label.color);
    },
    [setColor, labelColors],
  );

  const supports3d = useMemo(() => {
    if (!series) return false;
    return series.modality === 'CT' && (series.frameCount ?? 0) >= 30;
  }, [series]);

  const displayedLabels = useMemo(() => {
    if (!manifest) return [];
    const term = search.trim().toLowerCase();
    const filtered = manifest.labels.filter((label) => {
      if (label.volume_ml < minVolumeMl) return false;
      if (term && !label.name.toLowerCase().includes(term)) return false;
      return true;
    });
    if (sortMode === 'name') {
      return filtered.slice().sort((a, b) => a.name.localeCompare(b.name));
    }
    return filtered.slice().sort((a, b) => b.volume_ml - a.volume_ml);
  }, [manifest, search, sortMode, minVolumeMl]);

  if (!series) {
    return <ViewerEmptyState title={t('mesh.noSeries')} />;
  }

  if (!supports3d) {
    return (
      <div className={`relative h-full flex items-center justify-center ${className ?? ''}`}>
        <p className="text-sm text-muted-foreground">{t('mesh.unsupported')}</p>
      </div>
    );
  }

  const isRunning =
    !!status &&
    (status.status === 'queued' || status.status === 'started' || status.status === 'running');
  const isFinished = status?.status === 'finished';
  const progressPct = Math.round((status?.progress ?? 0) * 100);

  return (
    <div className={`relative h-full w-full ${className ?? ''}`}>
      <MeshNotForDiagnosticBanner />

      {/* Canvas */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Toolbar */}
      <div className="absolute top-12 left-4 z-20 flex items-center gap-2 rounded-md border bg-card/90 p-2 backdrop-blur">
        <Select value={preset} onValueChange={(v) => setPreset(v as SegmentationPreset)}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bone">{t('mesh.preset.bone')}</SelectItem>
            <SelectItem value="total">{t('mesh.preset.total')}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={handleStart}
          disabled={isStarting || isRunning || !studyUid}
        >
          {isStarting || isRunning ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : null}
          {t('mesh.generate')}
        </Button>
        <Button size="sm" variant="outline" onClick={resetCamera} disabled={!isFinished}>
          <RotateCcw className="h-4 w-4 mr-1" />
          {t('mesh.resetCamera')}
        </Button>
        <div className="ml-1 flex items-center gap-1 border-l pl-2">
          <Toggle
            size="sm"
            variant="outline"
            pressed={clipEnabled}
            onPressedChange={onClipToggle}
            disabled={!isFinished}
            aria-label={t('mesh.clipPlane.toggle')}
            title={t('mesh.clipPlane.toggle')}
          >
            <Scissors className="h-4 w-4" />
          </Toggle>
          {clipEnabled && (
            <Select
              value={clipAxis}
              onValueChange={(v) => onClipAxisChange(v as 'x' | 'y' | 'z')}
            >
              <SelectTrigger className="h-8 w-20" aria-label={t('mesh.clipPlane.axis')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="x">{t('mesh.clipPlane.axisX')}</SelectItem>
                <SelectItem value="y">{t('mesh.clipPlane.axisY')}</SelectItem>
                <SelectItem value="z">{t('mesh.clipPlane.axisZ')}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Push-to-PACS button: only available once the job is finished and the
          segmenter has produced a DICOM SEG (manifest.dicom_seg present). */}
      {isFinished && manifest?.dicom_seg && (() => {
        const alreadyPushed =
          pushState.phase === 'pushed' || Boolean(status?.dicom_seg_orthanc_url);
        const url =
          pushState.phase === 'pushed'
            ? pushState.url
            : status?.dicom_seg_orthanc_url ?? null;
        return (
          <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-1">
            <Button
              size="sm"
              variant={alreadyPushed ? 'outline' : 'default'}
              onClick={handlePushToPacs}
              disabled={pushState.phase === 'pushing'}
            >
              {pushState.phase === 'pushing' ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : alreadyPushed ? (
                <CheckCircle2 className="mr-1 h-4 w-4" />
              ) : (
                <UploadCloud className="mr-1 h-4 w-4" />
              )}
              {alreadyPushed
                ? t('mesh.pacs.pushedAgain')
                : t('mesh.pacs.push')}
            </Button>
            {alreadyPushed && url && (
              <span className="max-w-xs truncate rounded bg-card/90 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur" title={url}>
                {url}
              </span>
            )}
            {pushState.phase === 'failed' && (
              <span className="max-w-xs truncate rounded bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                {t('mesh.pacs.failed')}: {pushState.error}
              </span>
            )}
          </div>
        );
      })()}

      {/* Clip-plane position slider — only when active and we know the range. */}
      {clipEnabled && isFinished && (() => {
        const range = getClipPlaneRange(clipAxis);
        if (!range) return null;
        const value = clipPosition ?? (range[0] + range[1]) / 2;
        return (
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-md border bg-card/90 px-3 py-2 backdrop-blur">
            <span className="text-xs text-muted-foreground">
              {t('mesh.clipPlane.position', { axis: clipAxis.toUpperCase() })}
            </span>
            <Slider
              value={[value]}
              min={range[0]}
              max={range[1]}
              step={(range[1] - range[0]) / 200 || 1}
              onValueChange={([v]) => onClipPositionChange(v)}
              aria-label={t('mesh.clipPlane.position', { axis: clipAxis.toUpperCase() })}
              className="w-72"
            />
            <span className="w-14 text-right text-xs tabular-nums">
              {value.toFixed(1)} mm
            </span>
          </div>
        );
      })()}

      {/* Status / progress */}
      {isRunning && (
        <div className="absolute top-28 left-4 z-20 w-72 rounded-md border bg-card/90 p-3 backdrop-blur">
          <div className="text-xs font-medium mb-1">
            {t('mesh.status.running', { progress: progressPct })}
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </div>
      )}
      {status?.status === 'failed' && (
        <div
          className="absolute top-28 left-4 z-20 flex w-80 items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
          role="alert"
        >
          <div className="flex-1">
            <div className="font-semibold">{t('mesh.status.failed')}</div>
            <div className="mt-0.5 break-words">
              {status.error || error?.message || '—'}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleStart}
            disabled={isStarting || !studyUid}
            aria-label={t('mesh.retry')}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            {t('mesh.retry')}
          </Button>
        </div>
      )}

      {/* Loading-Panel: keep the right rail populated during the long
          segmenter run so the radiologist sees the workspace is alive. */}
      {isRunning && (
        <div
          className="absolute top-12 right-4 z-20 flex max-h-[85%] w-80 flex-col gap-2 rounded-md border bg-card/90 p-3 backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">
            {t('mesh.skeleton.loading')}
          </h3>
          <ul className="space-y-3" aria-hidden>
            {Array.from({ length: 5 }).map((_, idx) => (
              <li key={idx} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3 shrink-0 rounded-sm" />
                  <Skeleton className="h-3.5 w-4 shrink-0" />
                  <Skeleton className="h-3.5 flex-1" />
                  <Skeleton className="h-3 w-10 shrink-0" />
                </div>
                <Skeleton className="h-2 w-full" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Label panel */}
      {isFinished && manifest && manifest.labels.length > 0 && (
        <div className="absolute top-12 right-4 z-20 flex max-h-[85%] w-80 flex-col gap-2 rounded-md border bg-card/90 p-3 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              {t('mesh.labels')}{' '}
              <span className="font-normal normal-case text-muted-foreground/70">
                {displayedLabels.length}/{totalLabelCount}
              </span>
            </h3>
            <Toggle
              size="sm"
              variant="outline"
              pressed={sortMode === 'name'}
              onPressedChange={(pressed) => setSortMode(pressed ? 'name' : 'volume')}
              aria-label={t('mesh.sort.toggle')}
              title={
                sortMode === 'name'
                  ? t('mesh.sort.byName')
                  : t('mesh.sort.byVolume')
              }
            >
              {sortMode === 'name' ? (
                <ArrowDownAZ className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownWideNarrow className="h-3.5 w-3.5" />
              )}
            </Toggle>
          </div>

          {isLargeManifest && (
            <>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('mesh.search')}
                className="h-7 text-xs"
                aria-label={t('mesh.search')}
              />
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="shrink-0">{t('mesh.minVolume')}</span>
                <Slider
                  value={[minVolumeMl]}
                  min={0}
                  max={50}
                  step={1}
                  onValueChange={([v]) => setMinVolumeMl(v)}
                  aria-label={t('mesh.minVolume')}
                  className="flex-1"
                />
                <span className="w-10 text-right tabular-nums">
                  {minVolumeMl} ml
                </span>
              </div>
            </>
          )}

          <ul className="space-y-3 overflow-y-auto pr-1">
            {displayedLabels.map((label) => {
              const state =
                labelStates[label.id] ??
                defaultLabelState(label, { visible: false });
              const swatch = `rgb(${state.color.map((c) => Math.round(c * 255)).join(',')})`;
              const labelError = labelErrors[label.id];
              return (
                <li key={label.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label={t('mesh.colorPicker.open', { name: label.name })}
                          className="h-3 w-3 shrink-0 rounded-sm border ring-offset-background transition-shadow hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{ backgroundColor: swatch }}
                        />
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-60">
                        <MeshColorPicker
                          currentColor={state.color}
                          defaultColor={label.color}
                          onChange={(rgb) => onColorChange(label, rgb)}
                          onReset={() => onColorReset(label)}
                        />
                      </PopoverContent>
                    </Popover>
                    <Checkbox
                      id={`mesh-toggle-${label.id}`}
                      checked={state.visible}
                      onCheckedChange={(checked) =>
                        onToggle(label, checked === true)
                      }
                    />
                    <label
                      htmlFor={`mesh-toggle-${label.id}`}
                      className="flex-1 cursor-pointer truncate text-sm leading-none"
                      title={label.name}
                    >
                      {label.name.replace(/_/g, ' ')}
                    </label>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {label.volume_ml.toFixed(0)} ml
                    </span>
                    {labelError && (
                      <button
                        type="button"
                        onClick={() => retryLabel(label)}
                        aria-label={t('mesh.retryLabel', { name: label.name })}
                        title={labelError}
                        className="shrink-0 rounded p-0.5 text-destructive hover:bg-destructive/10"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {state.visible && (
                    <Slider
                      value={[state.opacity]}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={([value]) => onOpacity(label, value)}
                      aria-label={t('mesh.opacity')}
                    />
                  )}
                </li>
              );
            })}
            {displayedLabels.length === 0 && (
              <li className="text-xs text-muted-foreground">{t('mesh.noResults')}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
