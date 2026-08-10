import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ImageRef } from "@/types/radiology";
import { reportClient } from "@/services/reportClient";
import { useWorkspaceImageRefs } from "../useWorkspaceImageRefs";

vi.mock("@/services/reportClient", () => ({
  reportClient: { createComparison: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const createComparison = vi.mocked(reportClient.createComparison);

const ref = (overrides: Partial<ImageRef> = {}): ImageRef => ({
  studyId: "study-1",
  seriesId: "series-1",
  instanceId: "instance-1",
  frameIndex: 0,
  stackIndex: 0,
  wadoUrl: "wado://instance-1",
  ...overrides,
});

const setup = (
  options: Partial<Parameters<typeof useWorkspaceImageRefs>[0]> = {},
  priorDates: Array<[string, string]> = [],
) =>
  renderHook(() =>
    useWorkspaceImageRefs({
      currentStudyDate: "2026-03-14",
      priorStudyDateBySeries: new Map(priorDates),
      reportId: "report-1",
      ...options,
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  createComparison.mockResolvedValue(undefined as never);
});

describe("useWorkspaceImageRefs — current images", () => {
  it("dates the refs from the current study and marks them current", () => {
    const { result } = setup();

    act(() => result.current.setImageRefs([ref()]));

    expect(result.current.imageRefs[0]).toMatchObject({
      studyDate: "2026-03-14",
      role: "current",
      timeDeltaDays: 0,
    });
  });

  it("keeps a study date and role the viewer already supplied", () => {
    const { result } = setup();

    act(() => result.current.setImageRefs([ref({ studyDate: "2026-01-01", role: "prior" })]));

    expect(result.current.imageRefs[0]).toMatchObject({
      studyDate: "2026-01-01",
      role: "prior",
    });
  });

  it("leaves the delta alone when the current study has no date to anchor it", () => {
    const { result } = setup({ currentStudyDate: undefined });

    act(() => result.current.setImageRefs([ref({ timeDeltaDays: 42 })]));

    expect(result.current.imageRefs[0].timeDeltaDays).toBe(42);
    expect(result.current.imageRefs[0].studyDate).toBeUndefined();
  });
});

describe("useWorkspaceImageRefs — prior images", () => {
  it("dates a prior ref from its series and computes the interval", () => {
    const { result } = setup({}, [["series-old", "2026-03-07"]]);

    act(() => result.current.setPriorImageRefs([ref({ seriesId: "series-old" })]));

    expect(result.current.priorImageRefs[0]).toMatchObject({
      studyDate: "2026-03-07",
      role: "prior",
      timeDeltaDays: 7,
    });
  });

  it("leaves the interval undefined when the series is not in the lookup", () => {
    const { result } = setup({}, []);

    act(() => result.current.setPriorImageRefs([ref({ seriesId: "series-unknown" })]));

    expect(result.current.priorImageRefs[0].studyDate).toBeUndefined();
    expect(result.current.priorImageRefs[0].timeDeltaDays).toBeUndefined();
  });
});

describe("useWorkspaceImageRefs — comparison persistence", () => {
  it("records the comparison for the first prior series loaded", () => {
    const { result } = setup({}, [["series-old", "2026-03-07"]]);

    act(() =>
      result.current.setPriorImageRefs([
        ref({ studyId: "study-old", seriesId: "series-old" }),
        ref({ studyId: "study-older", seriesId: "series-older" }),
      ]),
    );

    expect(createComparison).toHaveBeenCalledTimes(1);
    expect(createComparison).toHaveBeenCalledWith("report-1", {
      priorStudyUid: "study-old",
      priorSeriesUid: "series-old",
      timeDeltaDays: 7,
    });
  });

  it("does not record the same comparison twice when the viewer re-emits its refs", () => {
    const { result } = setup({}, [["series-old", "2026-03-07"]]);
    const refs = [ref({ studyId: "study-old", seriesId: "series-old" })];

    act(() => result.current.setPriorImageRefs(refs));
    act(() => result.current.setPriorImageRefs(refs));

    expect(createComparison).toHaveBeenCalledTimes(1);
  });

  it("records again once a different prior study is chosen", () => {
    const { result } = setup({}, [
      ["series-old", "2026-03-07"],
      ["series-older", "2026-01-14"],
    ]);

    act(() =>
      result.current.setPriorImageRefs([ref({ studyId: "study-old", seriesId: "series-old" })]),
    );
    act(() =>
      result.current.setPriorImageRefs([ref({ studyId: "study-older", seriesId: "series-older" })]),
    );

    expect(createComparison).toHaveBeenCalledTimes(2);
    expect(createComparison).toHaveBeenLastCalledWith("report-1", {
      priorStudyUid: "study-older",
      priorSeriesUid: "series-older",
      timeDeltaDays: 59,
    });
  });

  it("does not record anything when no report is open", () => {
    const { result } = setup({ reportId: undefined }, [["series-old", "2026-03-07"]]);

    act(() =>
      result.current.setPriorImageRefs([ref({ studyId: "study-old", seriesId: "series-old" })]),
    );

    expect(createComparison).not.toHaveBeenCalled();
    expect(result.current.priorImageRefs).toHaveLength(1);
  });

  it("still shows the refs when recording the comparison fails", async () => {
    createComparison.mockRejectedValue(new Error("backend down"));
    const { result } = setup({}, [["series-old", "2026-03-07"]]);

    await act(async () => {
      result.current.setPriorImageRefs([ref({ studyId: "study-old", seriesId: "series-old" })]);
    });

    expect(result.current.priorImageRefs).toHaveLength(1);
  });

  it("clears the prior refs without a comparison write when the viewer unloads them", () => {
    const { result } = setup({}, []);

    act(() => result.current.setPriorImageRefs([]));

    expect(result.current.priorImageRefs).toEqual([]);
    expect(createComparison).not.toHaveBeenCalled();
  });
});

describe("useWorkspaceImageRefs — evidence selection", () => {
  it("starts with nothing selected and keeps the series and slice chosen", () => {
    const { result } = setup();
    expect(result.current.evidenceSelection).toBeNull();

    act(() => result.current.selectEvidence(ref({ seriesId: "series-2", stackIndex: 12 })));

    expect(result.current.evidenceSelection).toEqual({ seriesId: "series-2", stackIndex: 12 });
  });
});
