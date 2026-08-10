import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { Report } from "@/types/radiology";
import { useReportDraft } from "../useReportDraft";

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

const setup = (initial: Report | null) =>
  renderHook(({ value }) => useReportDraft(value), {
    initialProps: { value: initial },
  });

describe("useReportDraft", () => {
  it("starts empty when no report is open", () => {
    const { result } = setup(null);

    expect(result.current.findings).toBe("");
    expect(result.current.impression).toBe("");
  });

  it("shows the open report's text", () => {
    const { result } = setup(report({ findingsText: "Befund", impressionText: "Beurteilung" }));

    expect(result.current.findings).toBe("Befund");
    expect(result.current.impression).toBe("Beurteilung");
  });

  it("keeps what the user types, without writing it back to the report", () => {
    const { result } = setup(report({ findingsText: "Befund" }));

    act(() => result.current.setFindings("Befund, ergänzt"));

    expect(result.current.findings).toBe("Befund, ergänzt");
  });

  it("adopts text written to the report from elsewhere", () => {
    const { result, rerender } = setup(report({ findingsText: "Befund" }));

    rerender({ value: report({ findingsText: "Befund vom Server", impressionText: "KI-Text" }) });

    expect(result.current.findings).toBe("Befund vom Server");
    expect(result.current.impression).toBe("KI-Text");
  });

  it("leaves the draft alone when the report changes in ways the text does not", () => {
    const { result, rerender } = setup(report({ findingsText: "Befund" }));

    act(() => result.current.setFindings("lokal getippt"));
    rerender({ value: report({ findingsText: "Befund", qaStatus: "pass" }) });

    expect(result.current.findings).toBe("lokal getippt");
  });

  it("holds the last report's text when the report is closed", () => {
    const { result, rerender } = setup(report({ findingsText: "Befund" }));

    rerender({ value: null });

    expect(result.current.findings).toBe("Befund");
  });

  it("seeds both fields from a report on request", () => {
    const { result } = setup(null);

    act(() => result.current.loadFromReport(report({ findingsText: "A", impressionText: "B" })));

    expect(result.current.findings).toBe("A");
    expect(result.current.impression).toBe("B");
  });
});
