import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Series } from "@/types/radiology";
import type { SegmentationManifest, SegmentationPreset } from "@/types/segmentation";
import { useSegmentation } from "@/hooks/useSegmentation";
import { useMeshScene } from "@/hooks/useMeshScene";
import { useLabelColors } from "@/hooks/useLabelColors";
import { useMeshLabels } from "@/hooks/mesh/useMeshLabels";
import { useMeshLabelFilters } from "@/hooks/mesh/useMeshLabelFilters";
import { useMeshClipPlane } from "@/hooks/mesh/useMeshClipPlane";
import { useMeshPacsPush } from "@/hooks/mesh/useMeshPacsPush";
import { isLargeManifest, supportsMeshRendering } from "@/lib/meshLabels";
import { ViewerEmptyState } from "./ViewerEmptyState";
import { MeshNotForDiagnosticBanner } from "./MeshNotForDiagnosticBanner";
import { MeshViewerToolbar } from "./MeshViewerToolbar";
import { MeshJobError, MeshJobProgress } from "./MeshJobStatus";
import { MeshLabelPanel } from "./MeshLabelPanel";
import { MeshLabelSkeletonPanel } from "./MeshLabelSkeletonPanel";
import { MeshClipPlaneSlider } from "./MeshClipPlaneSlider";
import { MeshPacsPushControl } from "./MeshPacsPushControl";

interface MeshViewerProps {
  series: Series | null;
  studyUid?: string | null;
  className?: string;
}

const DEFAULT_PRESET: SegmentationPreset = "bone";

const NO_LABELS: SegmentationManifest["labels"] = [];

/**
 * 3D surface view of a CT series: queues a segmentation job, then renders each
 * returned organ as a vtk actor the radiologist can show, fade, recolour and
 * clip.
 *
 * The scene itself lives in `useMeshScene`; this component composes the job,
 * the label state and the panels around it.
 */
export function MeshViewer({ series, studyUid, className }: MeshViewerProps) {
  const { t } = useTranslation("viewer");
  const { jobId, status, isStarting, start, error } = useSegmentation();
  const scene = useMeshScene();
  const labelColors = useLabelColors();

  const [preset, setPreset] = useState<SegmentationPreset>(DEFAULT_PRESET);

  const manifest: SegmentationManifest | null = status?.manifest ?? null;
  const totalLabelCount = manifest?.labels.length ?? 0;

  const labels = useMeshLabels({
    manifest,
    jobId,
    isReady: scene.isReady,
    scene,
    labelColors,
  });
  const filters = useMeshLabelFilters(manifest?.labels ?? NO_LABELS);
  const clipPlane = useMeshClipPlane(scene);
  const pacsPush = useMeshPacsPush(jobId);

  const supports3d = useMemo(() => supportsMeshRendering(series), [series]);

  const labelsReset = labels.reset;
  const filtersReset = filters.reset;
  const clipPlaneReset = clipPlane.reset;
  const pacsPushReset = pacsPush.reset;

  const handleStart = useCallback(async () => {
    if (!series || !studyUid) return;
    labelsReset();
    filtersReset();
    clipPlaneReset();
    pacsPushReset();
    await start({
      studyUid,
      seriesUid: series.id,
      preset,
    });
  }, [series, studyUid, preset, start, labelsReset, filtersReset, clipPlaneReset, pacsPushReset]);

  if (!series) {
    return <ViewerEmptyState title={t("mesh.noSeries")} />;
  }

  if (!supports3d) {
    return (
      <div className={`relative h-full flex items-center justify-center ${className ?? ""}`}>
        <p className="text-sm text-muted-foreground">{t("mesh.unsupported")}</p>
      </div>
    );
  }

  const isRunning =
    !!status &&
    (status.status === "queued" || status.status === "started" || status.status === "running");
  const isFinished = status?.status === "finished";
  const progressPct = Math.round((status?.progress ?? 0) * 100);
  const clipRange = clipPlane.enabled ? clipPlane.getRange(clipPlane.axis) : null;

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      <MeshNotForDiagnosticBanner />

      {/* Canvas */}
      <div ref={scene.containerRef} className="absolute inset-0" />

      <MeshViewerToolbar
        preset={preset}
        onPresetChange={setPreset}
        onStart={handleStart}
        onResetCamera={scene.resetCamera}
        canStart={Boolean(studyUid)}
        isBusy={isStarting || isRunning}
        isFinished={isFinished}
        clipEnabled={clipPlane.enabled}
        clipAxis={clipPlane.axis}
        onClipToggle={clipPlane.toggle}
        onClipAxisChange={clipPlane.setAxis}
      />

      {/* Push-to-PACS: only once the job is finished and the segmenter has
          produced a DICOM SEG (manifest.dicom_seg present). */}
      {isFinished && manifest?.dicom_seg && (
        <MeshPacsPushControl
          state={pacsPush.state}
          existingUrl={status?.dicom_seg_orthanc_url}
          onPush={pacsPush.push}
        />
      )}

      {/* Clip-plane position — only when active and we know the range. */}
      {isFinished && clipRange && (
        <MeshClipPlaneSlider
          axis={clipPlane.axis}
          range={clipRange}
          position={clipPlane.position}
          onChange={clipPlane.setPosition}
        />
      )}

      {/* Status / progress */}
      {isRunning && <MeshJobProgress progressPct={progressPct} />}
      {status?.status === "failed" && (
        <MeshJobError
          message={status.error || error?.message || "—"}
          onRetry={handleStart}
          canRetry={!isStarting && Boolean(studyUid)}
        />
      )}

      {/* Keep the right rail populated during the long segmenter run so the
          radiologist sees the workspace is alive. */}
      {isRunning && <MeshLabelSkeletonPanel />}

      {isFinished && manifest && manifest.labels.length > 0 && (
        <MeshLabelPanel
          labels={filters.displayedLabels}
          totalLabelCount={totalLabelCount}
          labelStates={labels.labelStates}
          labelErrors={labels.labelErrors}
          showFilters={isLargeManifest(totalLabelCount)}
          search={filters.search}
          onSearchChange={filters.setSearch}
          minVolumeMl={filters.minVolumeMl}
          onMinVolumeChange={filters.setMinVolumeMl}
          sortMode={filters.sortMode}
          onSortModeChange={filters.setSortMode}
          onToggleLabel={labels.setVisible}
          onOpacityChange={labels.setOpacity}
          onColorChange={labels.setColor}
          onColorReset={labels.resetColor}
          onRetryLabel={labels.retry}
        />
      )}
    </div>
  );
}
