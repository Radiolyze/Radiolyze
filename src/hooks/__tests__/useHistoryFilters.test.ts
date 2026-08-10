import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { AuditLogEntry } from "@/services/auditMapping";
import { useHistoryFilters } from "../useHistoryFilters";

const entry = (overrides: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: "entry-1",
  eventType: "report_created",
  actorName: "Dr. Meier",
  patientName: "Doe, Jane",
  accessionNumber: "ACC-1",
  timestamp: new Date().toISOString(),
  ...overrides,
});

const entries: AuditLogEntry[] = [
  entry({ id: "a", actorName: "Dr. Meier", patientName: "Doe, Jane", accessionNumber: "ACC-1" }),
  entry({
    id: "b",
    eventType: "report_approved",
    actorName: "Dr. Schmidt",
    patientName: "Roe, John",
    accessionNumber: "ACC-2",
    reportId: "report-42",
  }),
  entry({
    id: "c",
    eventType: "impression_generated",
    actorName: "System",
    patientName: "Roe, John",
    accessionNumber: "ACC-3",
    studyId: "study-7",
    actorId: "svc-inference",
    timestamp: "2026-01-02T09:00:00.000Z",
  }),
];

const ids = (result: { filteredEntries: AuditLogEntry[] }) =>
  result.filteredEntries.map((item) => item.id);

describe("useHistoryFilters", () => {
  it("returns every entry until a filter is set", () => {
    const { result } = renderHook(() => useHistoryFilters(entries));
    expect(ids(result.current)).toEqual(["a", "b", "c"]);
  });

  it("searches patient, accession, report id, study id, actor name and actor id", () => {
    const { result } = renderHook(() => useHistoryFilters(entries));

    const expectMatch = (query: string, expected: string[]) => {
      act(() => result.current.setSearchQuery(query));
      expect(ids(result.current)).toEqual(expected);
    };

    expectMatch("roe", ["b", "c"]);
    expectMatch("ACC-2", ["b"]);
    expectMatch("report-42", ["b"]);
    expectMatch("study-7", ["c"]);
    expectMatch("schmidt", ["b"]);
    expectMatch("svc-inference", ["c"]);
    expectMatch("nothing matches this", []);
  });

  it("matches case-insensitively", () => {
    const { result } = renderHook(() => useHistoryFilters(entries));
    act(() => result.current.setSearchQuery("DOE, JANE"));
    expect(ids(result.current)).toEqual(["a"]);
  });

  it("filters by event type and by actor, and combines both with the search", () => {
    const { result } = renderHook(() => useHistoryFilters(entries));

    act(() => result.current.setEventFilter("report_approved"));
    expect(ids(result.current)).toEqual(["b"]);

    act(() => result.current.setEventFilter("all"));
    act(() => result.current.setActorFilter("System"));
    expect(ids(result.current)).toEqual(["c"]);

    act(() => result.current.setSearchQuery("Doe, Jane"));
    expect(ids(result.current)).toEqual([]);
  });

  it("lists each actor once, in the order they first appear", () => {
    const { result } = renderHook(() =>
      useHistoryFilters([...entries, entry({ id: "d", actorName: "Dr. Meier" })]),
    );
    expect(result.current.actors).toEqual(["Dr. Meier", "Dr. Schmidt", "System"]);
  });

  it("counts stats over every entry, not over the filtered view", () => {
    const { result } = renderHook(() => useHistoryFilters(entries));

    // a and b carry the current timestamp; c is dated 2026-01-02.
    expect(result.current.stats).toEqual({ today: 2, approved: 1, impressions: 1 });

    act(() => result.current.setActorFilter("System"));
    expect(ids(result.current)).toEqual(["c"]);
    expect(result.current.stats).toEqual({ today: 2, approved: 1, impressions: 1 });
  });
});
