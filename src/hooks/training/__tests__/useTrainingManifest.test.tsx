import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { MANIFEST_PREVIEW_LIMIT, type ExportSettingsValues } from "@/lib/trainingExport";
import {
  downloadBlob,
  getTrainingManifest,
  type ManifestResponse,
} from "@/services/trainingClient";
import { useTrainingManifest } from "../useTrainingManifest";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/services/trainingClient", () => ({
  getTrainingManifest: vi.fn(),
  downloadBlob: vi.fn(),
}));

const manifestRequest = vi.mocked(getTrainingManifest);
const download = vi.mocked(downloadBlob);

const settings = (overrides: Partial<ExportSettingsValues> = {}): ExportSettingsValues => ({
  format: "radiolyze",
  verifiedOnly: true,
  splitRatio: 0.8,
  categories: [],
  includeImages: true,
  ...overrides,
});

const manifest: ManifestResponse = { total: 4, images: [], status: { ok: 4, error: 0 } };

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function setup(initial: ExportSettingsValues = settings()) {
  return renderHook(({ value }) => useTrainingManifest(value), {
    initialProps: { value: initial },
    wrapper,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  manifestRequest.mockResolvedValue(manifest);
});

describe("useTrainingManifest", () => {
  it("starts with no manifest", () => {
    const { result } = setup();
    expect(result.current.manifest).toBeNull();
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.isDownloading).toBe(false);
  });

  it("caps a preview at the preview limit and does not check images", async () => {
    const { result } = setup(settings({ categories: ["nodule"], splitRatio: 0.6 }));

    act(() => result.current.generateManifest());

    await waitFor(() => expect(result.current.manifest).toEqual(manifest));
    expect(manifestRequest).toHaveBeenCalledWith({
      verifiedOnly: true,
      splitRatio: 0.6,
      categories: ["nodule"],
      limit: MANIFEST_PREVIEW_LIMIT,
      checkImages: undefined,
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("asks for an image check on the check path, still capped", async () => {
    const { result } = setup();

    act(() => result.current.checkImages());

    await waitFor(() => expect(result.current.manifest).toEqual(manifest));
    expect(manifestRequest).toHaveBeenCalledWith(
      expect.objectContaining({ limit: MANIFEST_PREVIEW_LIMIT, checkImages: true }),
    );
  });

  it("reports a failed preview without leaving a stale manifest behind", async () => {
    manifestRequest.mockRejectedValueOnce(new Error("upstream down"));
    const { result } = setup();

    act(() => result.current.generateManifest());

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(result.current.manifest).toBeNull();
  });

  it("downloads the whole catalogue rather than the preview, and never displays it", async () => {
    const { result } = setup();

    await act(() => result.current.downloadManifest());

    expect(manifestRequest).toHaveBeenCalledWith(
      expect.objectContaining({ limit: undefined, checkImages: true }),
    );
    expect(download).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringMatching(/^radiolyze-manifest-\d{4}-\d{2}-\d{2}\.json$/),
    );
    // The download path writes to disk; the preview panel keeps showing
    // whatever the user last generated, which here is nothing.
    expect(result.current.manifest).toBeNull();
    expect(result.current.isDownloading).toBe(false);
  });

  it("clears the downloading flag when the download fails", async () => {
    manifestRequest.mockRejectedValueOnce(new Error("nope"));
    const { result } = setup();

    await act(() => result.current.downloadManifest());

    expect(toast.error).toHaveBeenCalled();
    expect(result.current.isDownloading).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });

  it("discards the manifest when the corpus filter it was built from changes", async () => {
    // A manifest lists the frames one particular set of settings would export.
    // Left on screen after the settings move, it describes an export that is no
    // longer the one the button would run.
    const { result, rerender } = setup();

    act(() => result.current.generateManifest());
    await waitFor(() => expect(result.current.manifest).toEqual(manifest));

    rerender({ value: settings({ verifiedOnly: false }) });
    expect(result.current.manifest).toBeNull();
  });

  it("discards the manifest when the split ratio changes", async () => {
    const { result, rerender } = setup();

    act(() => result.current.generateManifest());
    await waitFor(() => expect(result.current.manifest).toEqual(manifest));

    rerender({ value: settings({ splitRatio: 0.5 }) });
    expect(result.current.manifest).toBeNull();
  });

  it("discards the manifest when rendered images are switched off", async () => {
    const { result, rerender } = setup();

    act(() => result.current.generateManifest());
    await waitFor(() => expect(result.current.manifest).toEqual(manifest));

    rerender({ value: settings({ includeImages: false }) });
    expect(result.current.manifest).toBeNull();
  });

  it("keeps the manifest when the category list is rebuilt with the same contents", async () => {
    // The page's own selection is stable state, but the reset keys on contents
    // so a caller passing a fresh array each render cannot wipe the panel.
    const { result, rerender } = setup(settings({ categories: ["nodule"] }));

    act(() => result.current.generateManifest());
    await waitFor(() => expect(result.current.manifest).toEqual(manifest));

    rerender({ value: settings({ categories: ["nodule"] }) });
    expect(result.current.manifest).toEqual(manifest);
  });

  it("discards the manifest when a category is added to the selection", async () => {
    const { result, rerender } = setup(settings({ categories: ["nodule"] }));

    act(() => result.current.generateManifest());
    await waitFor(() => expect(result.current.manifest).toEqual(manifest));

    rerender({ value: settings({ categories: ["nodule", "mass"] }) });
    expect(result.current.manifest).toBeNull();
  });

  it("keeps the manifest when only the export format changes", async () => {
    // The format decides how the frames are serialised, not which ones are in
    // the catalogue, so it leaves the manifest standing.
    const { result, rerender } = setup();

    act(() => result.current.generateManifest());
    await waitFor(() => expect(result.current.manifest).toEqual(manifest));

    rerender({ value: settings({ format: "coco" }) });
    expect(result.current.manifest).toEqual(manifest);
  });
});
