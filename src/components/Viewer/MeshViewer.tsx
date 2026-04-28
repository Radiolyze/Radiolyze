import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RotateCcw } from 'lucide-react';
import type { Series } from '@/types/radiology';
import type {
  LabelDisplayState,
  SegmentationLabel,
  SegmentationManifest,
  SegmentationPreset,
} from '@/types/segmentation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

function defaultLabelState(label: SegmentationLabel): LabelDisplayState {
  return {
    visible: true,
    opacity: 1,
    color: label.color,
  };
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
  const loadedLabelsRef = useRef<Set<number>>(new Set());

  const manifest: SegmentationManifest | null = status?.manifest ?? null;

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

  // Once the manifest arrives, hydrate label states + fetch meshes for visible labels.
  useEffect(() => {
    if (!manifest || !isReady) return;
    setLabelStates((current) => {
      if (Object.keys(current).length > 0) return current;
      const next: Record<number, LabelDisplayState> = {};
      manifest.labels.forEach((label) => {
        next[label.id] = defaultLabelState(label);
      });
      return next;
    });
    manifest.labels.forEach((label) => {
      if (labelStates[label.id]?.visible !== false) {
        void fetchAndLoadLabel(label);
      }
    });
    // labelStates intentionally not in deps to avoid loops; we only initialize once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, isReady, fetchAndLoadLabel]);

  const handleStart = useCallback(async () => {
    if (!series || !studyUid) return;
    loadedLabelsRef.current.clear();
    setLabelStates({});
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
        [label.id]: { ...(current[label.id] ?? defaultLabelState(label)), visible: checked },
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
        [label.id]: { ...(current[label.id] ?? defaultLabelState(label)), opacity: value },
      }));
      setOpacity(label.id, value);
    },
    [setOpacity],
  );

  const supports3d = useMemo(() => {
    if (!series) return false;
    return series.modality === 'CT' && (series.frameCount ?? 0) >= 30;
  }, [series]);

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
            <SelectItem value="total" disabled>
              {t('mesh.preset.total')}
            </SelectItem>
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
        <div className="absolute top-12 right-4 z-20 max-h-[80%] w-72 overflow-y-auto rounded-md border bg-card/90 p-3 backdrop-blur">
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            {t('mesh.labels')}
          </h3>
          <ul className="space-y-3">
            {manifest.labels.map((label) => {
              const state = labelStates[label.id] ?? defaultLabelState(label);
              const swatch = `rgb(${state.color.map((c) => Math.round(c * 255)).join(',')})`;
              return (
                <li key={label.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-3 w-3 rounded-sm border"
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
                      className="text-sm leading-none flex-1 cursor-pointer"
                    >
                      {label.name}
                    </label>
                    <span className="text-[10px] text-muted-foreground">
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
          </ul>
        </div>
      )}
    </div>
  );
}
