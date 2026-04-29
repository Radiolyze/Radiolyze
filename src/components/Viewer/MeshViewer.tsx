import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RotateCcw, ArrowDownAZ, ArrowDownWideNarrow } from 'lucide-react';
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
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { useSegmentation } from '@/hooks/useSegmentation';
import { useMeshScene } from '@/hooks/useMeshScene';
import { segmentationClient } from '@/services/segmentationClient';
import { ViewerEmptyState } from './ViewerEmptyState';
import { MeshNotForDiagnosticBanner } from './MeshNotForDiagnosticBanner';

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
  } = useMeshScene();

  const [preset, setPreset] = useState<SegmentationPreset>(DEFAULT_PRESET);
  const [labelStates, setLabelStates] = useState<Record<number, LabelDisplayState>>({});
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('volume');
  const [minVolumeMl, setMinVolumeMl] = useState(0);
  const loadedLabelsRef = useRef<Set<number>>(new Set());
  const hydratedManifestRef = useRef<string | null>(null);

  const manifest: SegmentationManifest | null = status?.manifest ?? null;
  const totalLabelCount = manifest?.labels.length ?? 0;
  const isLargeManifest = totalLabelCount > 20;

  const fetchAndLoadLabel = useCallback(
    async (label: SegmentationLabel) => {
      if (!jobId || loadedLabelsRef.current.has(label.id)) return;
      loadedLabelsRef.current.add(label.id);
      try {
        const buffer = await segmentationClient.fetchMesh(jobId, label.id, 'vtp');
        loadVtp(label.id, buffer);
        setColor(label.id, label.color);
      } catch (err) {
        loadedLabelsRef.current.delete(label.id);
        console.error(`Failed to load mesh ${label.id}`, err);
      }
    },
    [jobId, loadVtp, setColor],
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
      next[label.id] = defaultLabelState(label, { visible: initialVisible.has(label.id) });
    });
    setLabelStates(next);

    // Prefetch only the initially visible labels. Everything else loads
    // on-demand when the user toggles it on.
    manifest.labels
      .filter((label) => initialVisible.has(label.id))
      .forEach((label) => {
        void fetchAndLoadLabel(label);
      });
  }, [manifest, isReady, isLargeManifest, fetchAndLoadLabel]);

  const handleStart = useCallback(async () => {
    if (!series || !studyUid) return;
    loadedLabelsRef.current.clear();
    setLabelStates({});
    hydratedManifestRef.current = null;
    setSearch('');
    setMinVolumeMl(0);
    await start({
      studyUid,
      seriesUid: series.id,
      preset,
    });
  }, [series, studyUid, preset, start]);

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
      </div>

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
        <div className="absolute top-28 left-4 z-20 w-80 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
          {t('mesh.status.failed')}: {status.error || error?.message || '—'}
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
              return (
                <li key={label.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-3 w-3 shrink-0 rounded-sm border"
                      style={{ backgroundColor: swatch }}
                    />
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
