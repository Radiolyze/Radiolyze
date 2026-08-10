import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ExportSettingsValues } from "@/lib/trainingExport";
import { exportAndDownload } from "@/services/trainingClient";
import { useTrainingExport } from "../useTrainingExport";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/services/trainingClient", () => ({
  exportAndDownload: vi.fn(),
}));

const runExport = vi.mocked(exportAndDownload);

const settings = (overrides: Partial<ExportSettingsValues> = {}): ExportSettingsValues => ({
  format: "radiolyze",
  verifiedOnly: true,
  splitRatio: 0.8,
  categories: [],
  includeImages: false,
  ...overrides,
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  runExport.mockResolvedValue(undefined);
});

describe("useTrainingExport", () => {
  it("exports with the settings currently on screen", async () => {
    const { result } = renderHook(
      () => useTrainingExport(settings({ format: "coco", categories: ["nodule"] })),
      { wrapper },
    );

    act(() => result.current.exportDataset());

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(runExport).toHaveBeenCalledWith({
      format: "coco",
      verifiedOnly: true,
      splitRatio: 0.8,
      categories: ["nodule"],
      includeImages: false,
    });
  });

  it("surfaces the failure message rather than a generic error", async () => {
    runExport.mockRejectedValueOnce(new Error("corpus locked"));
    const { result } = renderHook(() => useTrainingExport(settings()), { wrapper });

    act(() => result.current.exportDataset());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ description: "corpus locked" }),
      ),
    );
  });

  it("reports while the export is in flight", async () => {
    let release: () => void = () => {};
    runExport.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { result } = renderHook(() => useTrainingExport(settings()), { wrapper });

    act(() => result.current.exportDataset());
    await waitFor(() => expect(result.current.isExporting).toBe(true));

    await act(async () => {
      release();
    });
    await waitFor(() => expect(result.current.isExporting).toBe(false));
  });
});
