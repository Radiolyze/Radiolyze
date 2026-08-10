import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LabelDisplayState,
  SegmentationLabel,
  SegmentationManifest,
} from "@/types/segmentation";
import type { UseMeshSceneResult } from "@/hooks/useMeshScene";
import type { UseLabelColorsResult } from "@/hooks/useLabelColors";
import { segmentationClient } from "@/services/segmentationClient";
import { defaultLabelState, initiallyVisibleLabels } from "@/lib/meshLabels";
import { logger } from "@/lib/logger";

/** The parts of the vtk scene the label list drives. */
type MeshLabelScene = Pick<
  UseMeshSceneResult,
  "loadVtp" | "setVisibility" | "setOpacity" | "setColor"
>;

export interface UseMeshLabelsOptions {
  manifest: SegmentationManifest | null;
  jobId: string | null;
  /** The vtk scene is only writable once the render window exists. */
  isReady: boolean;
  scene: MeshLabelScene;
  labelColors: UseLabelColorsResult;
}

export interface UseMeshLabelsResult {
  labelStates: Record<number, LabelDisplayState>;
  /** Per-label mesh-fetch failures, keyed by label id. */
  labelErrors: Record<number, string>;
  setVisible: (label: SegmentationLabel, visible: boolean) => void;
  setOpacity: (label: SegmentationLabel, opacity: number) => void;
  setColor: (label: SegmentationLabel, rgb: [number, number, number]) => void;
  /** Drops the user's colour override and returns to the manifest colour. */
  resetColor: (label: SegmentationLabel) => void;
  retry: (label: SegmentationLabel) => void;
  /** Clears all label state so the next manifest hydrates from scratch. */
  reset: () => void;
}

function withoutKey<T>(map: Record<number, T>, key: number): Record<number, T> {
  if (!(key in map)) return map;
  const { [key]: _dropped, ...rest } = map;
  return rest;
}

/**
 * Owns the per-label display state of the mesh viewer and keeps it in step with
 * the vtk scene: every mutator writes both the React state the panel renders
 * from and the actor in the scene.
 *
 * Meshes are fetched lazily. `loadedLabelsRef` — rather than `labelStates` —
 * guards against duplicate fetches, because a toggle and the hydration pass can
 * both ask for the same label within one render.
 */
export function useMeshLabels({
  manifest,
  jobId,
  isReady,
  scene,
  labelColors,
}: UseMeshLabelsOptions): UseMeshLabelsResult {
  const [labelStates, setLabelStates] = useState<Record<number, LabelDisplayState>>({});
  const [labelErrors, setLabelErrors] = useState<Record<number, string>>({});
  const loadedLabelsRef = useRef<Set<number>>(new Set());
  const hydratedManifestRef = useRef<string | null>(null);

  const { loadVtp, setVisibility: setSceneVisibility } = scene;
  const setSceneOpacity = scene.setOpacity;
  const setSceneColor = scene.setColor;

  const fetchAndLoadLabel = useCallback(
    async (label: SegmentationLabel) => {
      if (!jobId || loadedLabelsRef.current.has(label.id)) return;
      loadedLabelsRef.current.add(label.id);
      setLabelErrors((current) => withoutKey(current, label.id));
      try {
        const buffer = await segmentationClient.fetchMesh(jobId, label.id, "vtp");
        loadVtp(label.id, buffer);
        const effective = labelColors.getOverride(label.name) ?? label.color;
        setSceneColor(label.id, effective);
      } catch (err) {
        loadedLabelsRef.current.delete(label.id);
        const message = err instanceof Error ? err.message : String(err);
        setLabelErrors((current) => ({ ...current, [label.id]: message }));
        logger.error(`Failed to load mesh ${label.id}`, err);
      }
    },
    [jobId, loadVtp, setSceneColor, labelColors],
  );

  const retry = useCallback(
    (label: SegmentationLabel) => {
      loadedLabelsRef.current.delete(label.id);
      setLabelErrors((current) => withoutKey(current, label.id));
      void fetchAndLoadLabel(label);
    },
    [fetchAndLoadLabel],
  );

  // Hydrate label state once per manifest (re-runs when a fresh job lands).
  useEffect(() => {
    if (!manifest || !isReady) return;
    if (hydratedManifestRef.current === manifest.job_id) return;
    hydratedManifestRef.current = manifest.job_id;

    const initialVisible = initiallyVisibleLabels(manifest.labels);

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
    // through setColor directly, so re-running this effect on color changes
    // would rewrite labelStates and erase user toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, isReady, fetchAndLoadLabel]);

  /** Merges a patch into one label's state, seeding it if it isn't hydrated yet. */
  const patchLabelState = useCallback(
    (
      label: SegmentationLabel,
      fallbackVisible: boolean,
      patch: Partial<LabelDisplayState>,
    ): void => {
      setLabelStates((current) => ({
        ...current,
        [label.id]: {
          ...(current[label.id] ?? defaultLabelState(label, { visible: fallbackVisible })),
          ...patch,
        },
      }));
    },
    [],
  );

  const setVisible = useCallback(
    (label: SegmentationLabel, visible: boolean) => {
      patchLabelState(label, visible, { visible });
      if (visible) {
        void fetchAndLoadLabel(label);
      }
      setSceneVisibility(label.id, visible);
    },
    [patchLabelState, fetchAndLoadLabel, setSceneVisibility],
  );

  const setOpacity = useCallback(
    (label: SegmentationLabel, opacity: number) => {
      patchLabelState(label, true, { opacity });
      setSceneOpacity(label.id, opacity);
    },
    [patchLabelState, setSceneOpacity],
  );

  const setColor = useCallback(
    (label: SegmentationLabel, rgb: [number, number, number]) => {
      patchLabelState(label, true, { color: rgb });
      setSceneColor(label.id, rgb);
      labelColors.override(label.name, rgb);
    },
    [patchLabelState, setSceneColor, labelColors],
  );

  const resetColor = useCallback(
    (label: SegmentationLabel) => {
      labelColors.reset(label.name);
      patchLabelState(label, true, { color: label.color });
      setSceneColor(label.id, label.color);
    },
    [patchLabelState, setSceneColor, labelColors],
  );

  const reset = useCallback(() => {
    loadedLabelsRef.current.clear();
    hydratedManifestRef.current = null;
    setLabelStates({});
    setLabelErrors({});
  }, []);

  return {
    labelStates,
    labelErrors,
    setVisible,
    setOpacity,
    setColor,
    resetColor,
    retry,
    reset,
  };
}
