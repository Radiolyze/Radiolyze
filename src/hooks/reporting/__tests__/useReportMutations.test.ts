import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { reportClient } from "@/services/reportClient";
import { useReportMutations } from "../useReportMutations";
import type { Report } from "@/types/radiology";

vi.mock("@/services/reportClient", () => ({
  reportClient: {
    updateReport: vi.fn(),
    finalizeReport: vi.fn(),
  },
}));

const updateReport = vi.mocked(reportClient.updateReport);
const finalizeReport = vi.mocked(reportClient.finalizeReport);

const report = (overrides: Partial<Report> = {}): Report =>
  ({
    id: "rep-1",
    studyId: "study-1",
    patientId: "pat-1",
    status: "draft",
    findingsText: "old findings",
    impressionText: "old impression",
    qaStatus: "pending",
    qaWarnings: [],
    createdAt: "2026-07-01T12:00:00+00:00",
    updatedAt: "2026-07-01T12:00:00+00:00",
    ...overrides,
  }) as Report;

/** Drive the hook with real state, the way `useReport` composes it. */
function setup(initial: Report | null) {
  const setIsLoading = vi.fn();
  const setError = vi.fn();
  let current = initial;
  const setReport = vi.fn((update) => {
    current = typeof update === "function" ? update(current) : update;
  });

  const view = renderHook(() =>
    useReportMutations({ report: current, setReport, setIsLoading, setError }),
  );
  return {
    view,
    setIsLoading,
    setError,
    setReport,
    get report() {
      return current;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateReport.mockResolvedValue({ id: "rep-1", findings_text: "server findings" } as never);
  finalizeReport.mockResolvedValue({ id: "rep-1", status: "final" } as never);
});

describe("updateFindings", () => {
  it("persists through reportClient when the report has an id", async () => {
    const { view } = setup(report());
    await act(() => view.result.current.updateFindings("new findings"));

    expect(updateReport).toHaveBeenCalledWith("rep-1", { findingsText: "new findings" });
  });

  it("edits in memory when the report has not been created yet", async () => {
    const { view, report: read } = setup(report({ id: undefined as unknown as string }));
    await act(() => view.result.current.updateFindings("draft text"));

    expect(updateReport).not.toHaveBeenCalled();
    expect(read).toBeTruthy();
  });

  it("moves an uncreated report to draft once it has text", async () => {
    const state = setup(report({ id: undefined as unknown as string, status: "pending" }));
    await act(() => state.view.result.current.updateFindings("first words"));

    expect(state.report?.status).toBe("draft");
    expect(state.report?.findingsText).toBe("first words");
  });

  it("stores the failure message and rethrows", async () => {
    updateReport.mockRejectedValueOnce(new Error("network down"));
    const { view, setError } = setup(report());

    await expect(act(() => view.result.current.updateFindings("x"))).rejects.toThrow(
      "network down",
    );
    expect(setError).toHaveBeenCalledWith("network down");
  });

  it("falls back to a generic message when the rejection is not an Error", async () => {
    updateReport.mockRejectedValueOnce("just a string");
    const { view, setError } = setup(report());

    await expect(act(() => view.result.current.updateFindings("x"))).rejects.toBeTruthy();
    expect(setError).toHaveBeenCalledWith("Failed to update findings");
  });

  it("clears the loading flag even when the request fails", async () => {
    updateReport.mockRejectedValueOnce(new Error("boom"));
    const { view, setIsLoading } = setup(report());

    await expect(act(() => view.result.current.updateFindings("x"))).rejects.toThrow();
    expect(setIsLoading).toHaveBeenNthCalledWith(1, true);
    expect(setIsLoading).toHaveBeenLastCalledWith(false);
  });
});

describe("updateImpression", () => {
  it("persists through reportClient when the report has an id", async () => {
    const { view } = setup(report());
    await act(() => view.result.current.updateImpression("new impression"));

    expect(updateReport).toHaveBeenCalledWith("rep-1", { impressionText: "new impression" });
  });

  it("does not force a status change on an uncreated report", async () => {
    const state = setup(report({ id: undefined as unknown as string, status: "pending" }));
    await act(() => state.view.result.current.updateImpression("impression only"));

    // Findings are what make a report a draft; an impression alone does not.
    expect(state.report?.status).toBe("pending");
    expect(state.report?.impressionText).toBe("impression only");
  });
});

describe("approveReport", () => {
  it("finalizes through reportClient with the signature", async () => {
    const { view } = setup(report());
    await act(() => view.result.current.approveReport("Dr. Meier"));

    expect(finalizeReport).toHaveBeenCalledWith("rep-1", "Dr. Meier");
  });

  it("is a no-op for a report that was never created", async () => {
    const { view, setIsLoading } = setup(report({ id: undefined as unknown as string }));
    await act(() => view.result.current.approveReport("Dr. Meier"));

    expect(finalizeReport).not.toHaveBeenCalled();
    expect(setIsLoading).not.toHaveBeenCalled();
  });

  it("rethrows so a failed approval cannot read as a success", async () => {
    finalizeReport.mockRejectedValueOnce(new Error("rejected by server"));
    const { view, setError } = setup(report());

    await expect(act(() => view.result.current.approveReport("Dr. Meier"))).rejects.toThrow(
      "rejected by server",
    );
    expect(setError).toHaveBeenCalledWith("rejected by server");
  });
});
