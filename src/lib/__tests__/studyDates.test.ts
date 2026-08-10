import { describe, it, expect } from "vitest";
import { computeDeltaDays, toStudyTimestamp } from "../studyDates";

describe("toStudyTimestamp", () => {
  it("reads a bare YYYY-MM-DD as UTC midnight", () => {
    expect(toStudyTimestamp("2026-03-14")).toBe(Date.UTC(2026, 2, 14));
  });

  it("uses only the date part of a full timestamp, ignoring the time", () => {
    expect(toStudyTimestamp("2026-03-14T23:45:00Z")).toBe(Date.UTC(2026, 2, 14));
    expect(toStudyTimestamp("2026-03-14T00:15:00+02:00")).toBe(toStudyTimestamp("2026-03-14"));
  });

  it("falls back to Date.parse for formats that are not dash-separated", () => {
    expect(toStudyTimestamp("March 14, 2026 12:00:00 UTC")).toBe(
      Date.parse("March 14, 2026 12:00:00 UTC"),
    );
  });

  it("returns undefined for a missing or unparseable date", () => {
    expect(toStudyTimestamp()).toBeUndefined();
    expect(toStudyTimestamp("")).toBeUndefined();
    expect(toStudyTimestamp("not a date")).toBeUndefined();
  });

  it("hands a dash-separated value with a non-numeric part to Date.parse", () => {
    // The UTC shortcut only applies to three numbers; anything else falls
    // through, and Date.parse is lenient enough to read this one.
    expect(toStudyTimestamp("2026-MAR-14")).toBe(Date.parse("2026-MAR-14"));
  });

  it("hands a value with the wrong number of dash-separated parts to Date.parse", () => {
    expect(toStudyTimestamp("2026-03")).toBe(Date.parse("2026-03"));
  });
});

describe("computeDeltaDays", () => {
  it("counts whole days from the prior study to the current one", () => {
    expect(computeDeltaDays("2026-03-14", "2026-03-07")).toBe(7);
  });

  it("is zero when both studies are on the same day", () => {
    expect(computeDeltaDays("2026-03-14", "2026-03-14")).toBe(0);
  });

  it("counts across a month and a year boundary", () => {
    expect(computeDeltaDays("2026-03-01", "2026-02-01")).toBe(28);
    expect(computeDeltaDays("2026-01-01", "2025-12-31")).toBe(1);
  });

  it("is negative when the 'prior' is actually the newer study", () => {
    expect(computeDeltaDays("2026-03-07", "2026-03-14")).toBe(-7);
  });

  it("is unaffected by the time of day on either side", () => {
    // The reason the date part is taken as UTC: a naive parse of the two would
    // land 20 hours apart and round to a different number of days.
    expect(computeDeltaDays("2026-03-14T02:00:00Z", "2026-03-13T22:00:00Z")).toBe(1);
  });

  it("returns undefined when either date is missing or unparseable", () => {
    expect(computeDeltaDays(undefined, "2026-03-07")).toBeUndefined();
    expect(computeDeltaDays("2026-03-14", undefined)).toBeUndefined();
    expect(computeDeltaDays("nonsense", "2026-03-07")).toBeUndefined();
  });
});
