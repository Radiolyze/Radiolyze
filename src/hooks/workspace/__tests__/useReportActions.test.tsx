import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import type { Report } from "@/types/radiology";
import { auditLogger } from "@/services/auditLogger";
import { reportClient } from "@/services/reportClient";
import { useReportActions } from "../useReportActions";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/services/auditLogger", () => ({
  auditLogger: { logEvent: vi.fn() },
}));

vi.mock("@/services/reportClient", () => ({
  reportClient: { exportStructuredReport: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const logEvent = vi.mocked(auditLogger.logEvent);
const exportStructuredReport = vi.mocked(reportClient.exportStructuredReport);

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

const setup = (initial: Report | null, findings = "Befund") => {
  const approveReport = vi.fn().mockResolvedValue(undefined);
  const updateFindings = vi.fn().mockResolvedValue(undefined);
  const view = renderHook(
    ({ value }) => useReportActions({ report: value, findings, approveReport, updateFindings }),
    { initialProps: { value: initial } },
  );
  return { ...view, approveReport, updateFindings };
};

const createObjectURL = vi.fn(() => "blob:report");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  exportStructuredReport.mockResolvedValue({
    blob: new Blob(["{}"]),
    fileName: "report-1.json",
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useReportActions — audit", () => {
  it("records that the report was opened", () => {
    setup(report());

    expect(logEvent).toHaveBeenCalledWith({
      eventType: "report_opened",
      reportId: "report-1",
      studyId: "study-1",
    });
  });

  it("records nothing while no report is open", () => {
    setup(null);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("records once per report, not on every render", () => {
    const { rerender } = setup(report());
    rerender({ value: report({ qaStatus: "pass" }) });

    expect(logEvent).toHaveBeenCalledTimes(1);
  });

  it("records again when a different report is opened", () => {
    const { rerender } = setup(report());
    rerender({ value: report({ id: "report-2", studyId: "study-2" }) });

    expect(logEvent).toHaveBeenCalledTimes(2);
    expect(logEvent).toHaveBeenLastCalledWith({
      eventType: "report_opened",
      reportId: "report-2",
      studyId: "study-2",
    });
  });
});

describe("useReportActions — approve", () => {
  it("signs off with the trimmed name", async () => {
    const { result, approveReport } = setup(report());

    await act(async () => result.current.approve("  Dr. Meier  "));

    expect(approveReport).toHaveBeenCalledWith("Dr. Meier");
    expect(toast.success).toHaveBeenCalledWith("Report freigegeben (Dr. Meier)");
  });

  it("refuses a missing or blank signature", async () => {
    const { result, approveReport } = setup(report());

    await act(async () => result.current.approve("   "));
    await act(async () => result.current.approve());

    expect(approveReport).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(2);
  });

  it("reports a failed sign-off instead of throwing", async () => {
    const { result, approveReport } = setup(report());
    approveReport.mockRejectedValue(new Error("409"));

    await act(async () => result.current.approve("Dr. Meier"));

    expect(toast.error).toHaveBeenCalledWith("Approval failed");
  });
});

describe("useReportActions — save", () => {
  it("writes the draft findings back", async () => {
    const { result, updateFindings } = setup(report(), "Neuer Befund");

    await act(async () => result.current.saveFindings());

    expect(updateFindings).toHaveBeenCalledWith("Neuer Befund");
    expect(toast.success).toHaveBeenCalledWith("Findings saved");
  });

  it("does nothing when no report is open", async () => {
    const { result, updateFindings } = setup(null);

    await act(async () => result.current.saveFindings());

    expect(updateFindings).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("reports a failed save instead of throwing", async () => {
    const { result, updateFindings } = setup(report());
    updateFindings.mockRejectedValue(new Error("500"));

    await act(async () => result.current.saveFindings());

    expect(toast.error).toHaveBeenCalledWith("Failed to save report");
  });
});

describe("useReportActions — export", () => {
  it("downloads the structured report and releases the object URL", async () => {
    const { result } = setup(report());

    await act(async () => result.current.exportStructuredReport("json"));

    expect(exportStructuredReport).toHaveBeenCalledWith("report-1", "json");
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
    expect(toast.success).toHaveBeenCalledWith("DICOM SR exportiert (JSON)");
  });

  it("does nothing when no report is open", async () => {
    const { result } = setup(null);

    await act(async () => result.current.exportStructuredReport("dicom"));

    expect(exportStructuredReport).not.toHaveBeenCalled();
  });

  it("reports a failed export and leaves no object URL behind", async () => {
    const { result } = setup(report());
    exportStructuredReport.mockRejectedValue(new Error("500"));

    await act(async () => result.current.exportStructuredReport("dicom"));

    expect(toast.error).toHaveBeenCalledWith("Export failed");
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});
