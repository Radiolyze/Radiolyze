import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { orthancClient } from "@/services/orthancClient";
import { reportClient } from "@/services/reportClient";
import { useDicomWebQueue, DICOM_WEB_QUEUE_QUERY_KEY } from "../useDicomWebQueue";

vi.mock("@/services/orthancClient", () => ({
  orthancClient: { listStudies: vi.fn(), listSeries: vi.fn(), listInstances: vi.fn() },
}));

vi.mock("@/services/reportClient", () => ({
  reportClient: { getReport: vi.fn(), createReport: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const listStudies = vi.mocked(orthancClient.listStudies);
const listSeries = vi.mocked(orthancClient.listSeries);
const getReport = vi.mocked(reportClient.getReport);

const studyRecord = (studyId: string, patientId = "pat-1") => ({
  "0020000D": { Value: [studyId] },
  "00100020": { Value: [patientId] },
  "00080020": { Value: ["20260601"] },
});

const reportPayload = (studyId: string) => ({
  id: `report-${studyId}`,
  study_id: studyId,
  patient_id: "pat-1",
  status: "pending",
  findings_text: "",
  impression_text: "",
  qa_status: "pending",
  qa_warnings: [],
  created_at: "2026-06-01T12:00:00+00:00",
  updated_at: "2026-06-01T12:00:00+00:00",
});

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

// Mirrors the `QueryClient` defaults in `src/App.tsx`, so the caching these
// tests assert is the caching the app actually gets.
const testClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });

function setup(client = testClient()) {
  const view = renderHook(() => useDicomWebQueue(), { wrapper: wrapper(client) });
  return { ...view, client };
}

beforeEach(() => {
  vi.clearAllMocks();
  listStudies.mockResolvedValue([]);
  listSeries.mockResolvedValue([]);
  getReport.mockImplementation(async (reportId: string) =>
    reportPayload(reportId.replace(/^report-/, "")),
  );
});

describe("useDicomWebQueue", () => {
  it("starts in a loading state and resolves to one queue item per study", async () => {
    listStudies.mockResolvedValue([studyRecord("study-a"), studyRecord("study-b")]);

    const { result } = setup();
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((item) => item.id)).toEqual(["queue-study-a", "queue-study-b"]);
    expect(result.current.items[0].report.id).toBe("report-study-a");
    expect(result.current.error).toBeNull();
  });

  it("reports a load failure with an empty queue", async () => {
    listStudies.mockRejectedValue(new Error("orthanc down"));

    const { result } = setup();

    await waitFor(() =>
      expect(result.current.error).toBe("DICOMweb-Studien konnten nicht geladen werden."),
    );
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("serves a second consumer from cache instead of querying Orthanc twice", async () => {
    listStudies.mockResolvedValue([studyRecord("study-a")]);
    const client = testClient();

    const first = setup(client);
    await waitFor(() => expect(first.result.current.items).toHaveLength(1));

    const second = setup(client);

    expect(second.result.current.items).toHaveLength(1);
    expect(second.result.current.isLoading).toBe(false);
    expect(listStudies).toHaveBeenCalledTimes(1);
  });

  it("reloads when the queue key is invalidated", async () => {
    listStudies.mockResolvedValue([studyRecord("study-a")]);
    const client = testClient();

    const { result } = setup(client);
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    listStudies.mockResolvedValue([studyRecord("study-a"), studyRecord("study-b")]);
    await client.invalidateQueries({ queryKey: DICOM_WEB_QUEUE_QUERY_KEY });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(listStudies).toHaveBeenCalledTimes(2);
  });
});
