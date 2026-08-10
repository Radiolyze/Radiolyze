import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { auditClient } from "@/services/auditClient";
import { useStudyLookup } from "@/hooks/useStudyLookup";
import { logger } from "@/lib/logger";
import { useAuditLog } from "../useAuditLog";

vi.mock("@/services/auditClient", () => ({
  auditClient: { listEvents: vi.fn() },
}));

vi.mock("@/hooks/useStudyLookup", () => ({
  useStudyLookup: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const listEvents = vi.mocked(auditClient.listEvents);
const studyLookup = vi.mocked(useStudyLookup);

const studyDetails = {
  studyId: "study-abcdef123456",
  patientId: "pat-1",
  patientName: "Doe, Jane",
  mrn: "MRN-1",
  accessionNumber: "ACC-4711",
  modality: "CT",
  studyDescription: "Thorax",
  studyDate: "2026-08-01",
  referringPhysician: "Dr. Ref",
};

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { ...renderHook(() => useAuditLog(), { wrapper: wrapper(client) }), client };
}

beforeEach(() => {
  vi.clearAllMocks();
  listEvents.mockResolvedValue([]);
  studyLookup.mockReturnValue({
    studyMap: {},
    isLoading: false,
    error: null,
  } as ReturnType<typeof useStudyLookup>);
});

describe("useAuditLog", () => {
  it("maps the fetched events for display", async () => {
    listEvents.mockResolvedValue([
      {
        id: "event-1",
        event_type: "report_approved",
        actor_id: "user-1",
        timestamp: "2026-08-10T09:00:00.000Z",
        metadata: { patient_name: "Roe, John", accession_number: "ACC-9" },
      },
    ]);

    const { result } = setup();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toEqual([
      expect.objectContaining({
        id: "event-1",
        eventType: "report_approved",
        actorName: "user-1",
        patientName: "Roe, John",
        accessionNumber: "ACC-9",
      }),
    ]);
    expect(result.current.isError).toBe(false);
  });

  it("looks up each referenced study once", async () => {
    listEvents.mockResolvedValue([
      {
        id: "a",
        event_type: "report_opened",
        study_id: "study-1",
        timestamp: "2026-08-10T09:00:00.000Z",
      },
      {
        id: "b",
        event_type: "report_opened",
        study_id: "study-1",
        timestamp: "2026-08-10T10:00:00.000Z",
      },
      { id: "c", event_type: "report_opened", timestamp: "2026-08-10T11:00:00.000Z" },
    ]);

    const { result } = setup();

    await waitFor(() => expect(result.current.entries).toHaveLength(3));
    expect(studyLookup).toHaveBeenLastCalledWith(["study-1"]);
  });

  it("fills placeholder names from the study lookup", async () => {
    listEvents.mockResolvedValue([
      {
        id: "event-1",
        event_type: "report_opened",
        study_id: "study-abcdef123456",
        timestamp: "2026-08-10T09:00:00.000Z",
      },
    ]);
    studyLookup.mockReturnValue({
      studyMap: { "study-abcdef123456": studyDetails },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useStudyLookup>);

    const { result } = setup();

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0]).toEqual(
      expect.objectContaining({ patientName: "Doe, Jane", accessionNumber: "ACC-4711" }),
    );
  });

  it("logs a study-lookup failure instead of failing the timeline", async () => {
    studyLookup.mockReturnValue({
      studyMap: {},
      isLoading: false,
      error: "Orthanc unreachable",
    } as ReturnType<typeof useStudyLookup>);

    const { result } = setup();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(logger.warn).toHaveBeenCalledWith("Orthanc unreachable");
    expect(result.current.isError).toBe(false);
  });

  it("reports an error when the event list cannot be fetched", async () => {
    listEvents.mockRejectedValue(new Error("boom"));

    const { result } = setup();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.entries).toEqual([]);
  });
});
