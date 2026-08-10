import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import type { AIStatus, ImageRef, Report } from "@/types/radiology";
import { inferenceClient } from "@/services/inferenceClient";
import { extractInferenceFindings, pollInferenceResult } from "@/hooks/reporting/inferenceHelpers";
import { useWorkspaceInference } from "../useWorkspaceInference";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/services/inferenceClient", () => ({
  inferenceClient: { queueLocalize: vi.fn() },
}));

vi.mock("@/hooks/reporting/inferenceHelpers", () => ({
  pollInferenceResult: vi.fn(),
  extractInferenceFindings: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const queueLocalize = vi.mocked(inferenceClient.queueLocalize);
const poll = vi.mocked(pollInferenceResult);
const extractFindings = vi.mocked(extractInferenceFindings);

const report = (overrides: Partial<Report> = {}): Report => ({
  id: "report-1",
  studyId: "study-1",
  patientId: "pat-1",
  status: "pending",
  findingsText: "",
  impressionText: "",
  createdAt: "2026-03-14T00:00:00Z",
  updatedAt: "2026-03-14T00:00:00Z",
  qaStatus: "pending",
  qaWarnings: [],
  ...overrides,
});

const imageRef: ImageRef = {
  studyId: "study-1",
  seriesId: "series-1",
  instanceId: "instance-1",
  frameIndex: 0,
  stackIndex: 0,
  wadoUrl: "wado://instance-1",
};

interface SetupOverrides {
  report?: Report | null;
  findings?: string;
  imageRefs?: ImageRef[];
  priorImageRefs?: ImageRef[];
  liveAiStatus?: AIStatus;
  studyId?: string;
}

const setup = (overrides: SetupOverrides = {}) => {
  const setReport = vi.fn();
  const setFindings = vi.fn();
  const setImpression = vi.fn();
  const generateImpression = vi.fn().mockResolvedValue("Beurteilung");
  const analyzeImages = vi
    .fn()
    .mockResolvedValue({ findings: "KI-Befund", impression: "KI-Beurteilung" });
  const runQAChecks = vi.fn().mockResolvedValue(undefined);

  const view = renderHook(
    ({ live }: { live?: AIStatus }) =>
      useWorkspaceInference({
        report: overrides.report === undefined ? report() : overrides.report,
        setReport,
        studyId: "studyId" in overrides ? overrides.studyId : "study-1",
        findings: overrides.findings ?? "Befund",
        setFindings,
        setImpression,
        imageRefs: overrides.imageRefs ?? [imageRef],
        priorImageRefs: overrides.priorImageRefs ?? [],
        includeAllFrames: false,
        generateImpression,
        analyzeImages,
        runQAChecks,
        liveAiStatus: live,
      }),
    { initialProps: { live: overrides.liveAiStatus } },
  );

  return {
    ...view,
    setReport,
    setFindings,
    setImpression,
    generateImpression,
    analyzeImages,
    runQAChecks,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  queueLocalize.mockResolvedValue({ job_id: "job-1" } as never);
  poll.mockResolvedValue({} as never);
  extractFindings.mockReturnValue([]);
});

describe("useWorkspaceInference — status", () => {
  it("is idle with nothing running and nothing reported", () => {
    const { result } = setup();

    expect(result.current.aiStatus).toBe("idle");
    expect(result.current.isGenerating).toBe(false);
  });

  it("shows a job started elsewhere, reported over the WebSocket", () => {
    const { result } = setup({ liveAiStatus: "processing" });

    expect(result.current.aiStatus).toBe("processing");
    expect(result.current.isGenerating).toBe(true);
  });

  it("treats queued as generating too", () => {
    const { result } = setup({ liveAiStatus: "queued" });
    expect(result.current.isGenerating).toBe(true);
  });

  it("lets a live error through even with no local job", () => {
    const { result } = setup({ liveAiStatus: "error" });

    expect(result.current.aiStatus).toBe("error");
    expect(result.current.isGenerating).toBe(false);
  });

  it("prefers the local status once a local job has failed", async () => {
    const { result, generateImpression } = setup();
    generateImpression.mockRejectedValue(new Error("boom"));

    await act(async () => result.current.generateImpression());

    expect(result.current.aiStatus).toBe("error");
  });

  it("clears the local status when a different report is opened", async () => {
    const setReport = vi.fn();
    const generateImpression = vi.fn().mockRejectedValue(new Error("boom"));
    const { result, rerender } = renderHook(
      ({ value }: { value: Report }) =>
        useWorkspaceInference({
          report: value,
          setReport,
          studyId: "study-1",
          findings: "Befund",
          setFindings: vi.fn(),
          setImpression: vi.fn(),
          imageRefs: [imageRef],
          priorImageRefs: [],
          includeAllFrames: false,
          generateImpression,
          analyzeImages: vi.fn(),
          runQAChecks: vi.fn(),
        }),
      { initialProps: { value: report() } },
    );

    await act(async () => result.current.generateImpression());
    expect(result.current.aiStatus).toBe("error");

    rerender({ value: report({ id: "report-2" }) });

    expect(result.current.aiStatus).toBe("idle");
  });
});

describe("useWorkspaceInference — impression from findings", () => {
  it("writes the result into the draft and runs QA over the pair", async () => {
    const { result, generateImpression, setImpression, runQAChecks } = setup();

    await act(async () => result.current.generateImpression());

    expect(generateImpression).toHaveBeenCalledWith(
      "Befund",
      expect.objectContaining({ imageRefs: [imageRef], includeAllFrames: false }),
    );
    expect(setImpression).toHaveBeenCalledWith("Beurteilung");
    expect(runQAChecks).toHaveBeenCalledWith({
      reportId: "report-1",
      findingsText: "Befund",
      impressionText: "Beurteilung",
    });
  });

  it("refuses to run on empty findings", async () => {
    const { result, generateImpression } = setup({ findings: "   " });

    await act(async () => result.current.generateImpression());

    expect(generateImpression).not.toHaveBeenCalled();
  });

  it("refuses to start a second job while one is running", async () => {
    const { result, generateImpression } = setup({ liveAiStatus: "processing" });

    await act(async () => result.current.generateImpression());

    expect(generateImpression).not.toHaveBeenCalled();
  });

  it("surfaces a failure without running QA on a result it never got", async () => {
    const { result, generateImpression, runQAChecks } = setup();
    generateImpression.mockRejectedValue(new Error("boom"));

    await act(async () => result.current.generateImpression());

    expect(toast.error).toHaveBeenCalledWith("KI-Analyse fehlgeschlagen");
    expect(runQAChecks).not.toHaveBeenCalled();
  });
});

describe("useWorkspaceInference — full image read", () => {
  it("writes both fields and runs QA over what came back", async () => {
    const { result, setFindings, setImpression, runQAChecks } = setup();

    await act(async () => result.current.analyzeImages());

    expect(setFindings).toHaveBeenCalledWith("KI-Befund");
    expect(setImpression).toHaveBeenCalledWith("KI-Beurteilung");
    expect(runQAChecks).toHaveBeenCalledWith({
      reportId: "report-1",
      findingsText: "KI-Befund",
      impressionText: "KI-Beurteilung",
    });
    expect(toast.success).toHaveBeenCalledWith("KI-Analyse abgeschlossen");
  });

  it("refuses when the viewer has loaded no images at all", async () => {
    const { result, analyzeImages } = setup({ imageRefs: [], priorImageRefs: [] });

    await act(async () => result.current.analyzeImages());

    expect(analyzeImages).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Keine Bilder zum Analysieren vorhanden");
  });

  it("runs on priors alone when only they are loaded", async () => {
    const { result, analyzeImages } = setup({ imageRefs: [], priorImageRefs: [imageRef] });

    await act(async () => result.current.analyzeImages());

    expect(analyzeImages).toHaveBeenCalled();
  });

  it("clears the in-progress flag after a failure", async () => {
    const { result, analyzeImages } = setup();
    analyzeImages.mockRejectedValue(new Error("boom"));

    await act(async () => result.current.analyzeImages());

    await waitFor(() => expect(result.current.isAnalyzingImages).toBe(false));
    expect(toast.error).toHaveBeenCalledWith("KI-Analyse fehlgeschlagen");
  });
});

describe("useWorkspaceInference — single frame", () => {
  it("appends the localized findings to the ones already on the report", async () => {
    extractFindings.mockReturnValue([{ box_2d: [1, 2, 3, 4], label: "Nodule" }]);
    const { result, setReport } = setup();

    await act(async () => result.current.analyzeFrame(imageRef));

    expect(queueLocalize).toHaveBeenCalledWith({
      reportId: "report-1",
      studyId: "study-1",
      imageRef,
    });
    expect(toast.success).toHaveBeenCalledWith("1 Befund(e) lokalisiert");

    const update = setReport.mock.calls[0][0] as (prev: Report | null) => Report | null;
    const next = update(report({ inferenceFindings: [{ box_2d: [0, 0, 1, 1], label: "Alt" }] }));
    expect(next?.inferenceFindings).toHaveLength(2);
  });

  it("says so when the frame held nothing, without touching the report", async () => {
    extractFindings.mockReturnValue([]);
    const { result, setReport } = setup();

    await act(async () => result.current.analyzeFrame(imageRef));

    expect(toast.info).toHaveBeenCalledWith("Keine Befunde in diesem Frame erkannt");
    expect(setReport).not.toHaveBeenCalled();
  });

  it("refuses without a report or a study to attribute the job to", async () => {
    const { result } = setup({ report: null });

    await act(async () => result.current.analyzeFrame(imageRef));

    expect(queueLocalize).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Kein Report ausgewählt");
  });

  it("treats a queued job with no id as a failure", async () => {
    queueLocalize.mockResolvedValue({} as never);
    const { result } = setup();

    await act(async () => result.current.analyzeFrame(imageRef));

    expect(poll).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Frame-Analyse fehlgeschlagen");
    expect(result.current.aiStatus).toBe("error");
  });

  it("accepts the camelCase job id the backend also returns", async () => {
    queueLocalize.mockResolvedValue({ jobId: "job-2" } as never);
    const { result } = setup();

    await act(async () => result.current.analyzeFrame(imageRef));

    expect(poll).toHaveBeenCalledWith("job-2", expect.any(Function));
  });

  it("clears the in-progress flag after a failure", async () => {
    poll.mockRejectedValue(new Error("timeout"));
    const { result } = setup();

    await act(async () => result.current.analyzeFrame(imageRef));

    await waitFor(() => expect(result.current.isAnalyzingFrame).toBe(false));
  });
});
