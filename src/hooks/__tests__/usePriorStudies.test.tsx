import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { orthancClient } from "@/services/orthancClient";
import { usePriorStudies } from "../usePriorStudies";

vi.mock("@/services/orthancClient", () => ({
  orthancClient: { listStudies: vi.fn(), listSeries: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const listStudies = vi.mocked(orthancClient.listStudies);
const listSeries = vi.mocked(orthancClient.listSeries);

const studyRecord = (studyId: string, studyDate: string, patientId = "pat-1") => ({
  "0020000D": { Value: [studyId] },
  "00100020": { Value: [patientId] },
  "00080020": { Value: [studyDate] },
});

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function setup(patientId: string | undefined, currentStudyId: string | undefined, limit = 12) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = renderHook(({ studyId }) => usePriorStudies(patientId, studyId, limit), {
    initialProps: { studyId: currentStudyId },
    wrapper: wrapper(client),
  });
  return { ...view, client };
}

beforeEach(() => {
  vi.clearAllMocks();
  listStudies.mockResolvedValue([]);
  listSeries.mockResolvedValue([]);
});

describe("usePriorStudies", () => {
  it("returns the patient's other studies newest first, excluding the current one", async () => {
    listStudies.mockResolvedValue([
      studyRecord("study-old", "20260101"),
      studyRecord("study-current", "20260601"),
      studyRecord("study-recent", "20260501"),
    ]);

    const { result } = setup("pat-1", "study-current");

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.priorStudies.map((study) => study.id)).toEqual([
      "study-recent",
      "study-old",
    ]);
  });

  it("drops records belonging to a different patient", async () => {
    listStudies.mockResolvedValue([
      studyRecord("study-a", "20260101"),
      studyRecord("study-b", "20260201", "pat-2"),
    ]);

    const { result } = setup("pat-1", undefined);

    await waitFor(() => expect(result.current.priorStudies).toHaveLength(1));
    expect(result.current.priorStudies[0].id).toBe("study-a");
  });

  it("does not query without a patient", () => {
    const { result } = setup(undefined, "study-current");

    expect(listStudies).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.priorStudies).toEqual([]);
  });

  it("re-filters from cache when the reader moves to another study of the same patient", async () => {
    listStudies.mockResolvedValue([
      studyRecord("study-a", "20260101"),
      studyRecord("study-b", "20260201"),
    ]);

    const { result, rerender } = setup("pat-1", "study-a");
    await waitFor(() => expect(result.current.priorStudies.map((s) => s.id)).toEqual(["study-b"]));
    expect(listStudies).toHaveBeenCalledTimes(1);

    rerender({ studyId: "study-b" });

    expect(result.current.priorStudies.map((study) => study.id)).toEqual(["study-a"]);
    expect(listStudies).toHaveBeenCalledTimes(1);
  });

  it("reports a load failure and keeps the list empty", async () => {
    listStudies.mockRejectedValue(new Error("orthanc down"));

    const { result } = setup("pat-1", undefined);

    await waitFor(() => expect(result.current.error).toBe("Prior studies could not be loaded."));
    expect(result.current.priorStudies).toEqual([]);
  });
});
