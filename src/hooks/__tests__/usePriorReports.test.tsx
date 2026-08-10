import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { reportClient, type ReportResponsePayload } from "@/services/reportClient";
import { usePriorReports } from "../usePriorReports";

vi.mock("@/services/reportClient", () => ({
  reportClient: { getReportsByPatient: vi.fn() },
}));

const getReportsByPatient = vi.mocked(reportClient.getReportsByPatient);

const payload = (id: string): ReportResponsePayload =>
  ({
    id,
    study_id: `study-${id}`,
    patient_id: "pat-1",
    status: "final",
    findings_text: "",
    impression_text: "",
    created_at: "2026-07-01T12:00:00+00:00",
    updated_at: "2026-07-01T12:00:00+00:00",
  }) as ReportResponsePayload;

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function setup(patientId: string | undefined, currentReportId: string | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = renderHook(({ reportId }) => usePriorReports(patientId, reportId), {
    initialProps: { reportId: currentReportId },
    wrapper: wrapper(client),
  });
  return { ...view, client };
}

beforeEach(() => {
  vi.clearAllMocks();
  getReportsByPatient.mockResolvedValue([]);
});

describe("usePriorReports", () => {
  it("excludes the current report from the fetched list", async () => {
    getReportsByPatient.mockResolvedValue([payload("rep-1"), payload("rep-2")]);

    const { result } = setup("pat-1", "rep-1");

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.priorReports.map((report) => report.id)).toEqual(["rep-2"]);
  });

  it("returns every report when there is no current report to exclude", async () => {
    getReportsByPatient.mockResolvedValue([payload("rep-1"), payload("rep-2")]);

    const { result } = setup("pat-1", undefined);

    await waitFor(() => expect(result.current.priorReports).toHaveLength(2));
  });

  it("does not fetch without a patient, and reports neither loading nor error", () => {
    const { result } = setup(undefined, "rep-1");

    expect(getReportsByPatient).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.priorReports).toEqual([]);
  });

  it("re-filters from cache when the current report changes, without refetching", async () => {
    getReportsByPatient.mockResolvedValue([payload("rep-1"), payload("rep-2")]);

    const { result, rerender } = setup("pat-1", "rep-1");
    await waitFor(() => expect(result.current.priorReports).toHaveLength(1));
    expect(getReportsByPatient).toHaveBeenCalledTimes(1);

    rerender({ reportId: "rep-2" });

    expect(result.current.priorReports.map((report) => report.id)).toEqual(["rep-1"]);
    expect(getReportsByPatient).toHaveBeenCalledTimes(1);
  });

  it("surfaces the failure message and an empty list", async () => {
    getReportsByPatient.mockRejectedValue(new Error("backend unreachable"));

    const { result } = setup("pat-1", undefined);

    await waitFor(() => expect(result.current.error).toBe("backend unreachable"));
    expect(result.current.priorReports).toEqual([]);
  });

  it("refetches on refresh", async () => {
    const { result } = setup("pat-1", undefined);
    await waitFor(() => expect(getReportsByPatient).toHaveBeenCalledTimes(1));

    getReportsByPatient.mockResolvedValue([payload("rep-3")]);
    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.priorReports.map((r) => r.id)).toEqual(["rep-3"]));
    expect(getReportsByPatient).toHaveBeenCalledTimes(2);
  });
});
