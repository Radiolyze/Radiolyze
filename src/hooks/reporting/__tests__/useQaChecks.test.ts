import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { qaClient } from "@/services/qaClient";
import { useQaChecks } from "../useQaChecks";
import type { Report } from "@/types/radiology";

vi.mock("@/services/qaClient", () => ({
  qaClient: { runChecks: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const runChecks = vi.mocked(qaClient.runChecks);

const report = (overrides: Partial<Report> = {}): Report =>
  ({
    id: "rep-1",
    studyId: "study-1",
    patientId: "pat-1",
    status: "draft",
    findingsText: "findings from the report",
    impressionText: "impression from the report",
    qaStatus: "pending",
    qaWarnings: [],
    createdAt: "2026-07-01T12:00:00+00:00",
    updatedAt: "2026-07-01T12:00:00+00:00",
    ...overrides,
  }) as Report;

function setup(initial: Report | null = report()) {
  let current = initial;
  const seen: (Report | null)[] = [];
  const setReport = vi.fn((update) => {
    current = typeof update === "function" ? update(current) : update;
    seen.push(current);
  });

  const view = renderHook(() => useQaChecks({ report: current, setReport }));
  return {
    view,
    setReport,
    seen,
    get report() {
      return current;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  runChecks.mockResolvedValue({
    status: "pass",
    checks: [{ id: "c1", label: "Laterality", status: "pass" }],
    warnings: [],
  } as never);
});

describe("runQAChecks", () => {
  it("sends the report's own text when no override is given", async () => {
    const { view } = setup();
    await act(() => view.result.current.runQAChecks());

    expect(runChecks).toHaveBeenCalledWith({
      reportId: "rep-1",
      findingsText: "findings from the report",
      impressionText: "impression from the report",
    });
  });

  it("prefers explicitly passed text over the report's", async () => {
    const { view } = setup();
    await act(() =>
      view.result.current.runQAChecks({
        reportId: "other",
        findingsText: "typed but unsaved",
        impressionText: "also unsaved",
      }),
    );

    expect(runChecks).toHaveBeenCalledWith({
      reportId: "other",
      findingsText: "typed but unsaved",
      impressionText: "also unsaved",
    });
  });

  it("sends empty strings rather than undefined for missing text", async () => {
    const { view } = setup(report({ findingsText: undefined, impressionText: undefined }));
    await act(() => view.result.current.runQAChecks());

    expect(runChecks).toHaveBeenCalledWith({
      reportId: "rep-1",
      findingsText: "",
      impressionText: "",
    });
  });

  it("marks the report as checking before the request resolves", async () => {
    const { view, seen } = setup();
    await act(() => view.result.current.runQAChecks());

    expect(seen[0]?.qaStatus).toBe("checking");
  });

  it("publishes the outcome to both the hook and the report", async () => {
    const state = setup();
    const view = state.view;
    let outcome!: Awaited<ReturnType<typeof view.result.current.runQAChecks>>;
    await act(async () => {
      outcome = await view.result.current.runQAChecks();
    });

    expect(outcome.status).toBe("pass");
    expect(view.result.current.qaChecks).toHaveLength(1);
    expect(state.report?.qaStatus).toBe("pass");
    expect(state.report?.qaWarnings).toEqual(outcome.warnings);
  });

  it("resolves to a warn outcome instead of rejecting when the request fails", async () => {
    runChecks.mockRejectedValueOnce(new Error("QA service unreachable"));
    const state = setup();
    const view = state.view;

    let outcome!: Awaited<ReturnType<typeof view.result.current.runQAChecks>>;
    await act(async () => {
      outcome = await view.result.current.runQAChecks();
    });

    // QA is advisory: a failed run must warn, not break the editor.
    expect(outcome.status).toBe("warn");
    expect(outcome.checks).toEqual([]);
    expect(outcome.warnings).toHaveLength(1);
    expect(state.report?.qaStatus).toBe("warn");
  });

  it("does not leave the report stuck on 'checking' after a failure", async () => {
    runChecks.mockRejectedValueOnce(new Error("boom"));
    const state = setup();
    const view = state.view;
    await act(() => view.result.current.runQAChecks());

    expect(state.report?.qaStatus).not.toBe("checking");
  });

  it("starts with no checks when the mock fallback is off", () => {
    const { view } = setup();
    expect(view.result.current.qaChecks).toEqual([]);
  });
});
