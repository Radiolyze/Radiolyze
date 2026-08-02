import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ApiError } from "@/services/apiClient";
import { impressionClient } from "@/services/impressionClient";
import { inferenceClient } from "@/services/inferenceClient";
import { awaitInferenceResult } from "@/hooks/reporting/inferenceHelpers";
import { useInference } from "../useInference";
import type { Report } from "@/types/radiology";

vi.mock("@/services/inferenceClient", () => ({
  inferenceClient: { queueInference: vi.fn() },
}));

vi.mock("@/services/impressionClient", () => ({
  impressionClient: { generateImpression: vi.fn() },
}));

vi.mock("@/hooks/reporting/inferenceHelpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/reporting/inferenceHelpers")>();
  return { ...actual, awaitInferenceResult: vi.fn() };
});

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const queueInference = vi.mocked(inferenceClient.queueInference);
const generateImpressionService = vi.mocked(impressionClient.generateImpression);
const awaitResult = vi.mocked(awaitInferenceResult);

const report = (overrides: Partial<Report> = {}): Report =>
  ({
    id: "rep-1",
    studyId: "study-1",
    patientId: "pat-1",
    status: "draft",
    findingsText: "",
    impressionText: "",
    qaStatus: "pending",
    qaWarnings: [],
    createdAt: "2026-07-01T12:00:00+00:00",
    updatedAt: "2026-07-01T12:00:00+00:00",
    ...overrides,
  }) as Report;

function setup(initial: Report | null = report()) {
  let current = initial;
  const setIsLoading = vi.fn();
  const setReport = vi.fn((update) => {
    current = typeof update === "function" ? update(current) : update;
  });

  const view = renderHook(() => useInference({ report: current, setReport, setIsLoading }));
  return {
    view,
    setIsLoading,
    get report() {
      return current;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  queueInference.mockResolvedValue({ job_id: "job-1", status: "queued" } as never);
  awaitResult.mockResolvedValue({
    summary: "AI summary",
    confidence: 0.91,
    model_version: "medgemma-1",
  } as never);
  generateImpressionService.mockResolvedValue({ text: "fallback impression" } as never);
});

describe("generateImpression", () => {
  it("queues with the findings text and returns the summary", async () => {
    const state = setup();
    let summary = "";
    await act(async () => {
      summary = await state.view.result.current.generateImpression("consolidation, left base");
    });

    expect(summary).toBe("AI summary");
    expect(queueInference).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId: "rep-1",
        studyId: "study-1",
        findingsText: "consolidation, left base",
      }),
    );
  });

  it("writes the summary to the impression, leaving findings alone", async () => {
    const state = setup(report({ findingsText: "typed by the radiologist" }));
    await act(() => state.view.result.current.generateImpression("typed by the radiologist"));

    expect(state.report?.impressionText).toBe("AI summary");
    expect(state.report?.findingsText).toBe("typed by the radiologist");
  });

  it("records the inference metadata on the report", async () => {
    const state = setup();
    await act(() => state.view.result.current.generateImpression("f"));

    expect(state.report?.inferenceStatus).toBe("finished");
    expect(state.report?.inferenceSummary).toBe("AI summary");
    expect(state.report?.inferenceConfidence).toBe(0.91);
    expect(state.report?.inferenceModelVersion).toBe("medgemma-1");
  });

  it("promotes a pending report to draft", async () => {
    const state = setup(report({ status: "pending" }));
    await act(() => state.view.result.current.generateImpression("f"));

    expect(state.report?.status).toBe("draft");
  });

  it("leaves an already-finalized report's status alone", async () => {
    const state = setup(report({ status: "finalized" }));
    await act(() => state.view.result.current.generateImpression("f"));

    expect(state.report?.status).toBe("finalized");
  });

  it("reports status transitions to the caller", async () => {
    const onStatus = vi.fn();
    const state = setup();
    await act(() => state.view.result.current.generateImpression("f", { onStatus }));

    expect(onStatus).toHaveBeenCalledWith("queued");
    expect(onStatus).toHaveBeenLastCalledWith("idle");
  });

  it("rejects when the queue response carries no job id", async () => {
    queueInference.mockResolvedValueOnce({ status: "queued" } as never);
    generateImpressionService.mockRejectedValueOnce(new Error("no fallback either"));
    const state = setup();

    await expect(act(() => state.view.result.current.generateImpression("f"))).rejects.toBeTruthy();
  });

  it("falls back to the impression service on a transient failure", async () => {
    queueInference.mockRejectedValueOnce(new Error("gateway timeout"));
    const state = setup();

    let summary = "";
    await act(async () => {
      summary = await state.view.result.current.generateImpression("f");
    });

    expect(summary).toBe("fallback impression");
    expect(generateImpressionService).toHaveBeenCalledWith({
      reportId: "rep-1",
      findingsText: "f",
    });
    expect(state.report?.impressionText).toBe("fallback impression");
  });

  it("does not mask a 4xx — that is a bug or bad input, not a blip", async () => {
    queueInference.mockRejectedValueOnce(new ApiError("bad request", 422));
    const state = setup();

    await expect(act(() => state.view.result.current.generateImpression("f"))).rejects.toThrow(
      "bad request",
    );
    expect(generateImpressionService).not.toHaveBeenCalled();
  });

  it("marks a 4xx as a failed inference too", async () => {
    // Behaviour change from the pre-split code, where the 4xx early-return sat
    // above the status write so a rejected request left the previous
    // inferenceStatus in place. `analyzeImages` already marked every failure;
    // both paths now agree, and a request that failed reads as failed.
    queueInference.mockRejectedValueOnce(new ApiError("bad request", 422));
    const state = setup();

    await expect(act(() => state.view.result.current.generateImpression("f"))).rejects.toThrow();
    expect(state.report?.inferenceStatus).toBe("failed");
  });

  it("still falls back on a 5xx", async () => {
    queueInference.mockRejectedValueOnce(new ApiError("upstream exploded", 503));
    const state = setup();

    await act(() => state.view.result.current.generateImpression("f"));
    expect(generateImpressionService).toHaveBeenCalled();
  });

  it("rejects when the fallback also fails, and signals error status", async () => {
    queueInference.mockRejectedValueOnce(new Error("timeout"));
    generateImpressionService.mockRejectedValueOnce(new Error("impression down"));
    const onStatus = vi.fn();
    const state = setup();

    let caught: unknown;
    await act(async () => {
      await state.view.result.current.generateImpression("f", { onStatus }).catch((error) => {
        caught = error;
      });
    });

    expect(caught).toEqual(new Error("impression down"));
    expect(onStatus).toHaveBeenLastCalledWith("error");
  });

  it("treats a blank impression response as a failure", async () => {
    queueInference.mockRejectedValueOnce(new Error("timeout"));
    generateImpressionService.mockResolvedValueOnce({ text: "   " } as never);
    const state = setup();

    await expect(act(() => state.view.result.current.generateImpression("f"))).rejects.toThrow(
      "Impression response missing text",
    );
  });

  it("marks the inference failed on the report before falling back", async () => {
    queueInference.mockRejectedValueOnce(new Error("timeout"));
    const state = setup();
    await act(() => state.view.result.current.generateImpression("f"));

    expect(state.report?.inferenceStatus).toBe("failed");
  });

  it("clears the loading flag whichever way it ends", async () => {
    queueInference.mockRejectedValueOnce(new Error("timeout"));
    generateImpressionService.mockRejectedValueOnce(new Error("also down"));
    const state = setup();

    await act(async () => {
      await state.view.result.current.generateImpression("f").catch(() => {});
    });

    expect(state.setIsLoading).toHaveBeenNthCalledWith(1, true);
    expect(state.setIsLoading).toHaveBeenLastCalledWith(false);
  });
});

describe("analyzeImages", () => {
  it("queues with no findings text — the images are the input", async () => {
    const state = setup();
    await act(() => state.view.result.current.analyzeImages());

    expect(queueInference).toHaveBeenCalledWith(expect.objectContaining({ findingsText: "" }));
  });

  it("writes the summary to both findings and impression", async () => {
    const state = setup(report({ findingsText: "will be replaced" }));
    let result!: { findings: string; impression: string };
    await act(async () => {
      result = await state.view.result.current.analyzeImages();
    });

    expect(result).toEqual({ findings: "AI summary", impression: "AI summary" });
    expect(state.report?.findingsText).toBe("AI summary");
    expect(state.report?.impressionText).toBe("AI summary");
  });

  it("has no impression-service fallback — a text path cannot read images", async () => {
    queueInference.mockRejectedValueOnce(new Error("gateway timeout"));
    const state = setup();

    await expect(act(() => state.view.result.current.analyzeImages())).rejects.toThrow(
      "gateway timeout",
    );
    expect(generateImpressionService).not.toHaveBeenCalled();
  });

  it("marks the inference failed and signals error status", async () => {
    queueInference.mockRejectedValueOnce(new Error("boom"));
    const onStatus = vi.fn();
    const state = setup();

    let caught: unknown;
    await act(async () => {
      await state.view.result.current.analyzeImages({ onStatus }).catch((error) => {
        caught = error;
      });
    });

    expect(caught).toEqual(new Error("boom"));
    expect(state.report?.inferenceStatus).toBe("failed");
    expect(onStatus).toHaveBeenLastCalledWith("error");
  });

  it("does not write findings when the run failed", async () => {
    queueInference.mockRejectedValueOnce(new Error("boom"));
    const state = setup(report({ findingsText: "keep me" }));

    await expect(act(() => state.view.result.current.analyzeImages())).rejects.toThrow();
    expect(state.report?.findingsText).toBe("keep me");
  });
});

describe("shared runner", () => {
  it("prefers explicit ids over the report's", async () => {
    const state = setup();
    await act(() =>
      state.view.result.current.generateImpression("f", {
        reportId: "override-report",
        studyId: "override-study",
      }),
    );

    expect(queueInference).toHaveBeenCalledWith(
      expect.objectContaining({ reportId: "override-report", studyId: "override-study" }),
    );
  });

  it("passes current and prior image refs through as one list", async () => {
    const state = setup();
    await act(() =>
      state.view.result.current.generateImpression("f", {
        imageRefs: [{ wadoUrl: "https://pacs/current/1" }] as never,
        priorImageRefs: [{ wadoUrl: "https://pacs/prior/1" }] as never,
      }),
    );

    const payload = queueInference.mock.calls[0][0] as { imageRefs: unknown[] };
    expect(payload.imageRefs).toHaveLength(2);
  });

  it("sends inferenceUrl in preference to wadoUrl", async () => {
    const state = setup();
    await act(() =>
      state.view.result.current.generateImpression("f", {
        imageRefs: [
          { wadoUrl: "https://pacs/wado/1", inferenceUrl: "https://pacs/rendered/1" },
        ] as never,
      }),
    );

    const payload = queueInference.mock.calls[0][0] as { imageUrls: string[] };
    expect(payload.imageUrls).toEqual(["https://pacs/rendered/1"]);
  });

  it("rejects a result with no summary", async () => {
    awaitResult.mockResolvedValueOnce({ confidence: 0.5 } as never);
    const state = setup();

    await expect(act(() => state.view.result.current.analyzeImages())).rejects.toThrow(
      "Inference result missing summary",
    );
  });

  it("records the queued job id and status while the job runs", async () => {
    queueInference.mockResolvedValueOnce({ job_id: "job-42", status: "queued" } as never);
    const state = setup();
    await act(() => state.view.result.current.analyzeImages());

    expect(state.report?.inferenceJobId).toBe("job-42");
  });
});
