import { describe, it, expect } from "vitest";
import type { AuditEventResponse } from "@/services/auditClient";
import type { StudyLookupEntry } from "@/hooks/useStudyLookup";
import {
  enrichEntriesWithStudyDetails,
  groupEntriesByDate,
  isOnSameDay,
  mapAuditEventToEntry,
  mapAuditEventsToEntries,
  resolveAccessionNumber,
  resolveActorName,
  resolveEventType,
  resolvePatientName,
  type AuditLogEntry,
} from "../auditMapping";

const event = (overrides: Partial<AuditEventResponse> = {}): AuditEventResponse => ({
  id: "event-1",
  event_type: "report_created",
  timestamp: "2026-08-10T09:00:00.000Z",
  ...overrides,
});

const entry = (overrides: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: "entry-1",
  eventType: "report_created",
  actorName: "System",
  patientName: "-",
  accessionNumber: "—",
  timestamp: "2026-08-10T09:00:00.000Z",
  ...overrides,
});

const studyDetails = (overrides: Partial<StudyLookupEntry> = {}): StudyLookupEntry => ({
  studyId: "study-abcdef123456",
  patientId: "pat-1",
  patientName: "Doe, Jane",
  mrn: "MRN-1",
  accessionNumber: "ACC-4711",
  modality: "CT",
  studyDescription: "Thorax",
  studyDate: "2026-08-01",
  referringPhysician: "Dr. Ref",
  ...overrides,
});

describe("resolveEventType", () => {
  it("keeps event types the timeline renders", () => {
    expect(resolveEventType("report_approved")).toBe("report_approved");
  });

  it("buckets an unknown type rather than rendering the raw identifier", () => {
    expect(resolveEventType("something_new_backend_side")).toBe("other");
  });
});

describe("resolveActorName", () => {
  it("prefers actor_name over the other metadata spellings", () => {
    expect(
      resolveActorName(
        event({
          actor_id: "user-1",
          metadata: { actor_name: "Dr. Meier", signature: "sig", approved_by: "someone" },
        }),
      ),
    ).toBe("Dr. Meier");
  });

  it("falls back through signature, approved_by and the actor id", () => {
    expect(resolveActorName(event({ metadata: { signature: "Dr. Schmidt" } }))).toBe("Dr. Schmidt");
    expect(resolveActorName(event({ metadata: { approved_by: "Dr. Weiss" } }))).toBe("Dr. Weiss");
    expect(resolveActorName(event({ actor_id: "user-7" }))).toBe("user-7");
    expect(resolveActorName(event())).toBe("System");
  });

  it("ignores blank and non-string metadata values", () => {
    expect(resolveActorName(event({ actor_id: "user-7", metadata: { actor_name: "   " } }))).toBe(
      "user-7",
    );
    expect(resolveActorName(event({ actor_id: "user-7", metadata: { actor_name: 42 } }))).toBe(
      "user-7",
    );
  });
});

describe("resolvePatientName", () => {
  it("uses the recorded patient name when the event carries one", () => {
    expect(resolvePatientName(event({ metadata: { patient_name: "Doe, John" } }))).toBe(
      "Doe, John",
    );
  });

  it("falls back to a shortened study, then report, then the unknown label", () => {
    expect(resolvePatientName(event({ study_id: "study-abcdef123456" }))).toBe("Study study-ab...");
    expect(resolvePatientName(event({ report_id: "report-abcdef" }))).toBe("Report report-a...");
    expect(resolvePatientName(event())).toBe("-");
  });
});

describe("resolveAccessionNumber", () => {
  it("uses the recorded accession, then a truncated study or report id", () => {
    expect(resolveAccessionNumber(event({ metadata: { accession_number: "ACC-1" } }))).toBe(
      "ACC-1",
    );
    expect(resolveAccessionNumber(event({ study_id: "study-abcdef123456" }))).toBe("study-abcdef");
    expect(resolveAccessionNumber(event({ report_id: "report-abcdef123" }))).toBe("report-abcde");
    expect(resolveAccessionNumber(event())).toBe("—");
  });
});

describe("mapAuditEventToEntry", () => {
  it("maps the response shape onto what the timeline renders", () => {
    expect(
      mapAuditEventToEntry(
        event({
          id: "event-9",
          event_type: "report_approved",
          actor_id: "user-3",
          report_id: "report-1",
          study_id: "study-1",
          metadata: { patient_name: "Doe, Jane", accession_number: "ACC-9" },
        }),
      ),
    ).toEqual({
      id: "event-9",
      eventType: "report_approved",
      actorId: "user-3",
      actorName: "user-3",
      reportId: "report-1",
      studyId: "study-1",
      patientName: "Doe, Jane",
      accessionNumber: "ACC-9",
      timestamp: "2026-08-10T09:00:00.000Z",
      metadata: { patient_name: "Doe, Jane", accession_number: "ACC-9" },
    });
  });

  it("turns nulls into undefined so optional fields stay absent", () => {
    const mapped = mapAuditEventToEntry(
      event({ actor_id: null, report_id: null, study_id: null, metadata: null }),
    );
    expect(mapped.actorId).toBeUndefined();
    expect(mapped.reportId).toBeUndefined();
    expect(mapped.studyId).toBeUndefined();
    expect(mapped.metadata).toBeUndefined();
  });

  it("maps a list in order", () => {
    expect(
      mapAuditEventsToEntries([event({ id: "a" }), event({ id: "b" })]).map((e) => e.id),
    ).toEqual(["a", "b"]);
  });
});

describe("enrichEntriesWithStudyDetails", () => {
  it("fills placeholder patient names and accessions from the study lookup", () => {
    const [enriched] = enrichEntriesWithStudyDetails(
      [
        entry({
          studyId: "study-abcdef123456",
          patientName: "Study study-ab...",
          accessionNumber: "study-abcdef",
        }),
      ],
      { "study-abcdef123456": studyDetails() },
    );

    expect(enriched.patientName).toBe("Doe, Jane");
    expect(enriched.accessionNumber).toBe("ACC-4711");
  });

  it("keeps values the event itself recorded", () => {
    const [enriched] = enrichEntriesWithStudyDetails(
      [
        entry({
          studyId: "study-abcdef123456",
          patientName: "Doe, John",
          accessionNumber: "ACC-1",
        }),
      ],
      { "study-abcdef123456": studyDetails() },
    );

    expect(enriched.patientName).toBe("Doe, John");
    expect(enriched.accessionNumber).toBe("ACC-1");
  });

  it("returns the same array when the lookup has nothing to add", () => {
    const entries = [entry({ studyId: "study-1" }), entry({ id: "entry-2" })];
    expect(enrichEntriesWithStudyDetails(entries, {})).toBe(entries);
  });
});

// Grouping compares local calendar days, so the fixtures are built from local
// date parts rather than UTC strings — otherwise the expectations would flip in
// a runner whose timezone pushes 09:00 UTC onto the previous day.
const localAt = (day: number, hour: number) => new Date(2026, 7, day, hour, 0, 0).toISOString();

describe("groupEntriesByDate", () => {
  const now = new Date(2026, 7, 10, 12, 0, 0);
  const labels = {
    today: "Heute",
    yesterday: "Gestern",
    other: (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
  };

  it("groups under today, yesterday and the calendar date", () => {
    const grouped = groupEntriesByDate(
      [
        entry({ id: "a", timestamp: localAt(10, 9) }),
        entry({ id: "b", timestamp: localAt(9, 9) }),
        entry({ id: "c", timestamp: localAt(1, 9) }),
        entry({ id: "d", timestamp: localAt(10, 11) }),
      ],
      labels,
      now,
    );

    expect(Array.from(grouped.keys())).toEqual(["Heute", "Gestern", "2026-8-1"]);
    expect(grouped.get("Heute")?.map((e) => e.id)).toEqual(["a", "d"]);
  });

  it("keeps the order entries arrive in", () => {
    const grouped = groupEntriesByDate(
      [
        entry({ id: "old", timestamp: localAt(1, 9) }),
        entry({ id: "new", timestamp: localAt(10, 9) }),
      ],
      labels,
      now,
    );

    expect(Array.from(grouped.keys())).toEqual(["2026-8-1", "Heute"]);
  });

  it("crosses a month boundary when yesterday was the first of the month", () => {
    const grouped = groupEntriesByDate(
      [entry({ id: "a", timestamp: new Date(2026, 6, 31, 9, 0, 0).toISOString() })],
      labels,
      new Date(2026, 7, 1, 12, 0, 0),
    );

    expect(Array.from(grouped.keys())).toEqual(["Gestern"]);
  });
});

describe("isOnSameDay", () => {
  const now = new Date(2026, 7, 10, 12, 0, 0);

  it("compares calendar days, not elapsed time", () => {
    expect(isOnSameDay(localAt(10, 0), now)).toBe(true);
    expect(isOnSameDay(localAt(9, 23), now)).toBe(false);
  });
});
