import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  downloadBlob,
  getTrainingManifest,
  type ExportStats,
  type ManifestResponse,
} from "@/services/trainingClient";
import type { ExportSettingsValues } from "@/lib/trainingExport";
// The real instance, so the toasts below assert on the copy a user sees
// rather than on a bare key.
import i18n from "@/i18n";
import { useTrainingManifest } from "../useTrainingManifest";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/services/trainingClient", async () => {
  const actual = await vi.importActual<typeof import("@/services/trainingClient")>(
    "@/services/trainingClient",
  );
  return { ...actual, getTrainingManifest: vi.fn(), downloadBlob: vi.fn() };
});

const manifestFetch = vi.mocked(getTrainingManifest);
const download = vi.mocked(downloadBlob);

type ManifestSettings = Pick<
  ExportSettingsValues,
  "verifiedOnly" | "splitRatio" | "categories" | "includeImages"
>;

const settings = (overrides: Partial<ManifestSettings> = {}): ManifestSettings => ({
  verifiedOnly: true,
  splitRatio: 0.8,
  categories: [],
  includeImages: true,
  ...overrides,
});

const stats: ExportStats = {
  totalAnnotations: 40,
  verifiedAnnotations: 30,
  categories: {},
  studies: 3,
  series: 5,
};

const response = (overrides: Partial<ManifestResponse> = {}): ManifestResponse => ({
  total: 120,
  images: [
    {
      id: "img-1",
      image_path: "images/img-1.png",
      wado_url: "http://pacs/img-1",
      study_id: "study-1",
      series_id: "series-1",
      instance_id: "inst-1",
      frame_index: 0,
      frame_number: 1,
      splits: ["train"],
    },
  ],
  ...overrides,
});

interface SetupProps {
  current: ManifestSettings;
  currentStats?: ExportStats;
}

function setup(props: Partial<SetupProps> = {}) {
  const current = props.current ?? settings();
  // Tested with `in` rather than a default value: a default would also fire on
  // a deliberate `undefined`, which is exactly the "no stats yet" case here.
  const currentStats = "currentStats" in props ? props.currentStats : stats;

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook<ReturnType<typeof useTrainingManifest>, SetupProps>(
    ({ current: value, currentStats: valueStats }) => useTrainingManifest(value, valueStats),
    { initialProps: { current, currentStats }, wrapper },
  );
}

/** Generate a preview and wait for it to land on screen. */
async function generate(result: { current: ReturnType<typeof useTrainingManifest> }) {
  act(() => result.current.generatePreview());
  await waitFor(() => expect(result.current.manifest).not.toBeNull());
}

// Pinned rather than inherited: the ambient language under jsdom is not the
// app's default, and the assertions below name the copy.
beforeAll(() => i18n.changeLanguage("en"));
afterAll(() => i18n.changeLanguage("de"));

beforeEach(() => {
  vi.clearAllMocks();
  manifestFetch.mockResolvedValue(response());
});

describe("useTrainingManifest", () => {
  it("previews a limited manifest without checking the images", async () => {
    const { result } = setup();
    await generate(result);

    expect(manifestFetch).toHaveBeenCalledWith({
      verifiedOnly: true,
      splitRatio: 0.8,
      categories: undefined,
      limit: 50,
      checkImages: undefined,
    });
    expect(result.current.manifest?.total).toBe(120);
    expect(toast.success).toHaveBeenCalledWith("Manifest generated", {
      description: "120 images in the data capture catalogue.",
    });
  });

  it("asks the backend to fetch each image only for the explicit check", async () => {
    const { result } = setup();
    act(() => result.current.checkImages());

    await waitFor(() =>
      expect(manifestFetch).toHaveBeenCalledWith(
        expect.objectContaining({ checkImages: true, limit: 50 }),
      ),
    );
  });

  it("carries the current category selection into the request", async () => {
    const { result } = setup({
      current: settings({ categories: ["nodule"], verifiedOnly: false }),
    });
    await generate(result);

    expect(manifestFetch).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ["nodule"], verifiedOnly: false }),
    );
  });

  it("discards a manifest when the settings it describes change", async () => {
    // Each of these changes what would be catalogued, so leaving the previous
    // result on screen would report counts for a set the user is no longer
    // exporting.
    for (const change of [
      { verifiedOnly: false },
      { splitRatio: 0.6 },
      { categories: ["nodule"] },
    ] as Partial<ManifestSettings>[]) {
      const { result, rerender } = setup();
      await generate(result);

      rerender({ current: settings(change), currentStats: stats });
      expect(result.current.manifest).toBeNull();
    }
  });

  it("keeps the manifest when a setting is rewritten to the same value", async () => {
    const { result, rerender } = setup();
    await generate(result);

    // A fresh object with identical values — a re-render, not an edit.
    rerender({ current: settings(), currentStats: stats });
    expect(result.current.manifest).not.toBeNull();
  });

  it("discards the manifest when rendered images are switched off", async () => {
    const { result, rerender } = setup();
    await generate(result);

    rerender({ current: settings({ includeImages: false }), currentStats: stats });
    expect(result.current.manifest).toBeNull();

    // And switching back on does not resurrect it.
    rerender({ current: settings({ includeImages: true }), currentStats: stats });
    expect(result.current.manifest).toBeNull();
  });

  it("downloads the unlimited manifest without replacing the preview on screen", async () => {
    const { result } = setup();
    await generate(result);
    const preview = result.current.manifest;

    manifestFetch.mockResolvedValue(response({ total: 999 }));
    await act(() => result.current.downloadManifest());

    expect(manifestFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: undefined, checkImages: true }),
    );
    expect(download).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringMatching(/^radiolyze-manifest-\d{4}-\d{2}-\d{2}\.json$/),
    );
    // The 999-entry download must not overwrite what the preview reported.
    expect(result.current.manifest).toBe(preview);
  });

  it("clears the downloading flag after a failed download", async () => {
    manifestFetch.mockRejectedValue(new Error("manifest unavailable"));
    const { result } = setup();

    await act(() => result.current.downloadManifest());

    expect(result.current.isDownloading).toBe(false);
    expect(download).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Manifest download failed", {
      description: "manifest unavailable",
    });
  });

  it("reports a failed preview without clearing what is already shown", async () => {
    const { result } = setup();
    await generate(result);

    manifestFetch.mockRejectedValue(new Error("backend down"));
    act(() => result.current.generatePreview());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Manifest failed", {
        description: "backend down",
      }),
    );
    // A failed refresh leaves the previous result up rather than blanking the
    // panel — the settings it describes have not changed.
    expect(result.current.manifest).not.toBeNull();
  });

  it("cannot generate anything until there are annotations to catalogue", () => {
    const { result, rerender } = setup({ currentStats: undefined });
    expect(result.current.canGenerate).toBe(false);

    rerender({ current: settings(), currentStats: { ...stats, totalAnnotations: 0 } });
    expect(result.current.canGenerate).toBe(false);

    rerender({ current: settings(), currentStats: stats });
    expect(result.current.canGenerate).toBe(true);
  });
});
