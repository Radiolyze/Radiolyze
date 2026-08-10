import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { SegmentationLabel, SegmentationManifest } from "@/types/segmentation";

const mocks = vi.hoisted(() => ({
  fetchMesh: vi.fn(),
}));

vi.mock("@/services/segmentationClient", () => ({
  segmentationClient: { fetchMesh: mocks.fetchMesh },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { useMeshLabels, type UseMeshLabelsOptions } from "../useMeshLabels";

const label = (
  id: number,
  name: string,
  volume_ml: number,
  color: [number, number, number] = [1, 0, 0],
): SegmentationLabel => ({
  id,
  name,
  color,
  volume_ml,
  voxel_count: 1,
  mask_url: "a",
  mesh_url: "b",
});

const manifestOf = (jobId: string, labels: SegmentationLabel[]): SegmentationManifest => ({
  job_id: jobId,
  preset: "total",
  source: { study_uid: "s", series_uid: "s.1", modality: "CT" },
  volume: { spacing: [1, 1, 1], origin: [0, 0, 0], direction: [], shape: [] },
  labels,
  warnings: [],
});

const scene = {
  loadVtp: vi.fn(),
  setVisibility: vi.fn(),
  setOpacity: vi.fn(),
  setColor: vi.fn(),
};

const labelColors = {
  getOverride: vi.fn<(name: string) => [number, number, number] | undefined>(() => undefined),
  override: vi.fn(),
  reset: vi.fn(),
  resetAll: vi.fn(),
};

const options = (overrides: Partial<UseMeshLabelsOptions> = {}): UseMeshLabelsOptions => ({
  manifest: manifestOf("job-1", [label(1, "liver", 1500), label(2, "spleen", 80)]),
  jobId: "job-1",
  isReady: true,
  scene,
  labelColors,
  ...overrides,
});

const fetchedIds = () =>
  (mocks.fetchMesh.mock.calls as unknown[][])
    .map((call) => call[1] as number)
    .sort((a, b) => a - b);

describe("useMeshLabels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchMesh.mockResolvedValue(new ArrayBuffer(8));
    labelColors.getOverride.mockReturnValue(undefined);
  });

  describe("hydration", () => {
    it("shows and prefetches every label of a small manifest", async () => {
      const { result } = renderHook(() => useMeshLabels(options()));

      await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledTimes(2));
      expect(result.current.labelStates[1]).toEqual({
        visible: true,
        opacity: 1,
        color: [1, 0, 0],
      });
      expect(result.current.labelStates[2].visible).toBe(true);
      expect(fetchedIds()).toEqual([1, 2]);
    });

    it("prefetches only the largest labels of a big manifest", async () => {
      const labels = Array.from({ length: 25 }, (_, i) => label(i + 1, `organ_${i + 1}`, 100 - i));
      const { result } = renderHook(() =>
        useMeshLabels(options({ manifest: manifestOf("big", labels) })),
      );

      await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledTimes(10));
      expect(fetchedIds()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      // Every label still gets a state; the tail is just hidden.
      expect(Object.keys(result.current.labelStates)).toHaveLength(25);
      expect(result.current.labelStates[11].visible).toBe(false);
    });

    it("waits for the render window before touching the scene", () => {
      const { result } = renderHook(() => useMeshLabels(options({ isReady: false })));
      expect(mocks.fetchMesh).not.toHaveBeenCalled();
      expect(result.current.labelStates).toEqual({});
    });

    it("does not re-hydrate the same job, so user toggles survive a re-render", async () => {
      const props = options();
      const { result, rerender } = renderHook((p: UseMeshLabelsOptions) => useMeshLabels(p), {
        initialProps: props,
      });
      await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledTimes(2));

      act(() => result.current.setVisible(props.manifest!.labels[0], false));
      // A new manifest object carrying the same job — what a status poll returns.
      rerender({ ...props, manifest: manifestOf("job-1", props.manifest!.labels) });

      expect(result.current.labelStates[1].visible).toBe(false);
      expect(mocks.fetchMesh).toHaveBeenCalledTimes(2);
    });

    it("re-hydrates when a fresh job lands", async () => {
      const props = options();
      const { result, rerender } = renderHook((p: UseMeshLabelsOptions) => useMeshLabels(p), {
        initialProps: props,
      });
      await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledTimes(2));

      rerender({
        ...props,
        jobId: "job-2",
        manifest: manifestOf("job-2", [label(7, "aorta", 30)]),
      });

      await waitFor(() => expect(result.current.labelStates[7]).toBeDefined());
      expect(mocks.fetchMesh).toHaveBeenLastCalledWith("job-2", 7, "vtp");
    });

    it("applies a stored colour override to the initial state and the scene", async () => {
      labelColors.getOverride.mockImplementation((name) =>
        name === "liver" ? [0, 1, 0] : undefined,
      );
      const { result } = renderHook(() => useMeshLabels(options()));

      await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledTimes(2));
      expect(result.current.labelStates[1].color).toEqual([0, 1, 0]);
      expect(scene.setColor).toHaveBeenCalledWith(1, [0, 1, 0]);
      // A label without an override keeps its manifest colour.
      expect(result.current.labelStates[2].color).toEqual([1, 0, 0]);
    });
  });

  describe("visibility", () => {
    it("fetches a hidden label the first time it is switched on", async () => {
      const labels = Array.from({ length: 25 }, (_, i) => label(i + 1, `organ_${i + 1}`, 100 - i));
      const manifest = manifestOf("big", labels);
      const { result } = renderHook(() => useMeshLabels(options({ manifest })));
      await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledTimes(10));

      act(() => result.current.setVisible(labels[20], true));

      await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledWith("job-1", 21, "vtp"));
      expect(result.current.labelStates[21].visible).toBe(true);
      expect(scene.setVisibility).toHaveBeenLastCalledWith(21, true);
    });

    it("does not refetch a mesh that is already loaded", async () => {
      const props = options();
      const { result } = renderHook(() => useMeshLabels(props));
      await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledTimes(2));

      act(() => result.current.setVisible(props.manifest!.labels[0], false));
      act(() => result.current.setVisible(props.manifest!.labels[0], true));

      expect(mocks.fetchMesh).toHaveBeenCalledTimes(2);
      expect(scene.setVisibility).toHaveBeenLastCalledWith(1, true);
    });

    it("hides in the scene without fetching", async () => {
      const props = options();
      const { result } = renderHook(() => useMeshLabels(props));
      await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledTimes(2));
      mocks.fetchMesh.mockClear();

      act(() => result.current.setVisible(props.manifest!.labels[1], false));

      expect(mocks.fetchMesh).not.toHaveBeenCalled();
      expect(scene.setVisibility).toHaveBeenLastCalledWith(2, false);
      expect(result.current.labelStates[2].visible).toBe(false);
    });
  });

  describe("appearance", () => {
    it("writes opacity to both state and scene", async () => {
      const props = options();
      const { result } = renderHook(() => useMeshLabels(props));
      await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledTimes(2));

      act(() => result.current.setOpacity(props.manifest!.labels[0], 0.35));

      expect(result.current.labelStates[1].opacity).toBe(0.35);
      expect(scene.setOpacity).toHaveBeenCalledWith(1, 0.35);
    });

    it("persists a colour change so it carries to the next study", async () => {
      const props = options();
      const { result } = renderHook(() => useMeshLabels(props));
      await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledTimes(2));

      act(() => result.current.setColor(props.manifest!.labels[0], [0, 0, 1]));

      expect(result.current.labelStates[1].color).toEqual([0, 0, 1]);
      expect(scene.setColor).toHaveBeenLastCalledWith(1, [0, 0, 1]);
      expect(labelColors.override).toHaveBeenCalledWith("liver", [0, 0, 1]);
    });

    it("drops the override and returns to the manifest colour on reset", async () => {
      const props = options();
      const { result } = renderHook(() => useMeshLabels(props));
      await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledTimes(2));
      act(() => result.current.setColor(props.manifest!.labels[0], [0, 0, 1]));

      act(() => result.current.resetColor(props.manifest!.labels[0]));

      expect(labelColors.reset).toHaveBeenCalledWith("liver");
      expect(result.current.labelStates[1].color).toEqual([1, 0, 0]);
      expect(scene.setColor).toHaveBeenLastCalledWith(1, [1, 0, 0]);
    });
  });

  describe("fetch failures", () => {
    it("records the message against the label", async () => {
      mocks.fetchMesh.mockRejectedValue(new Error("network blip"));
      const { result } = renderHook(() => useMeshLabels(options()));

      await waitFor(() => expect(result.current.labelErrors[1]).toBe("network blip"));
      expect(result.current.labelErrors[2]).toBe("network blip");
    });

    it("stringifies a non-Error rejection", async () => {
      mocks.fetchMesh.mockRejectedValue("504");
      const { result } = renderHook(() => useMeshLabels(options()));

      await waitFor(() => expect(result.current.labelErrors[1]).toBe("504"));
    });

    it("retries a failed label and clears the error on success", async () => {
      const props = options();
      mocks.fetchMesh.mockRejectedValueOnce(new Error("network blip"));
      const { result } = renderHook(() => useMeshLabels(props));
      await waitFor(() => expect(result.current.labelErrors[1]).toBe("network blip"));

      act(() => result.current.retry(props.manifest!.labels[0]));

      await waitFor(() => expect(result.current.labelErrors[1]).toBeUndefined());
      expect(scene.loadVtp).toHaveBeenCalledWith(1, expect.any(ArrayBuffer));
    });

    it("keeps the mesh unloaded after a failure, so a later toggle refetches it", async () => {
      const props = options();
      mocks.fetchMesh.mockRejectedValueOnce(new Error("network blip"));
      const { result } = renderHook(() => useMeshLabels(props));
      await waitFor(() => expect(result.current.labelErrors[1]).toBe("network blip"));
      mocks.fetchMesh.mockClear();

      act(() => result.current.setVisible(props.manifest!.labels[0], true));

      await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledWith("job-1", 1, "vtp"));
    });
  });

  describe("reset", () => {
    it("clears state and lets the same manifest hydrate again", async () => {
      const { result } = renderHook(() => useMeshLabels(options()));
      await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledTimes(2));

      act(() => result.current.reset());

      // Re-running the same job (the "Generate" button) must re-fetch, which is
      // why reset drops the loaded set and the hydration marker together.
      await waitFor(() => expect(mocks.fetchMesh).toHaveBeenCalledTimes(4));
      expect(result.current.labelErrors).toEqual({});
    });
  });

  it("does nothing without a job id", async () => {
    const { result } = renderHook(() => useMeshLabels(options({ jobId: null })));

    await waitFor(() => expect(result.current.labelStates[1]).toBeDefined());
    expect(mocks.fetchMesh).not.toHaveBeenCalled();
  });
});
