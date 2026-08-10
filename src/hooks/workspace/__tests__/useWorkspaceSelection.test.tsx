import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { QueueItem, Report, Series } from "@/types/radiology";
import { useWorkspaceSelection } from "../useWorkspaceSelection";

const series = (id: string): Series => ({
  id,
  studyId: "study-1",
  seriesNumber: 1,
  seriesDescription: id,
  modality: "CT",
  frameCount: 10,
});

const report = (id: string, findingsText = ""): Report => ({
  id,
  studyId: "study-1",
  patientId: "pat-1",
  status: "pending",
  findingsText,
  impressionText: "",
  createdAt: "2026-03-14T00:00:00Z",
  updatedAt: "2026-03-14T00:00:00Z",
  qaStatus: "pending",
  qaWarnings: [],
});

const item = (id: string, seriesIds: string[] = ["series-1"], findingsText = ""): QueueItem => ({
  id,
  patient: { id: "pat-1", name: "Doe^Jane", dateOfBirth: "1980-01-01", gender: "F", mrn: "MRN-1" },
  study: {
    id: `study-of-${id}`,
    patientId: "pat-1",
    accessionNumber: `ACC-${id}`,
    modality: "CT",
    studyDate: "2026-03-14",
    studyDescription: "Thorax",
    referringPhysician: "Dr. Who",
    series: seriesIds.map(series),
  },
  report: report(`report-${id}`, findingsText),
  priority: "normal",
});

const setup = (initialItems: QueueItem[]) => {
  const onSelectItem = vi.fn();
  const view = renderHook(({ queueItems }) => useWorkspaceSelection({ queueItems, onSelectItem }), {
    initialProps: { queueItems: initialItems },
  });
  return { ...view, onSelectItem };
};

describe("useWorkspaceSelection", () => {
  it("selects nothing while the queue is empty", () => {
    const { result, onSelectItem } = setup([]);

    expect(result.current.selectedQueueItem).toBeNull();
    expect(result.current.selectedSeries).toBeNull();
    expect(onSelectItem).not.toHaveBeenCalled();
  });

  it("selects the first item, its first series and its report once the queue arrives", () => {
    const items = [item("a", ["series-a1", "series-a2"]), item("b")];
    const { result, rerender, onSelectItem } = setup([]);

    rerender({ queueItems: items });

    expect(result.current.selectedQueueItem?.id).toBe("a");
    expect(result.current.selectedSeries?.id).toBe("series-a1");
    expect(onSelectItem).toHaveBeenCalledWith(items[0]);
  });

  it("selects a different item on request, moving the series with it", () => {
    const items = [item("a"), item("b", ["series-b1"])];
    const { result, onSelectItem } = setup(items);
    onSelectItem.mockClear();

    act(() => result.current.selectQueueItem(items[1]));

    expect(result.current.selectedQueueItem?.id).toBe("b");
    expect(result.current.selectedSeries?.id).toBe("series-b1");
    expect(onSelectItem).toHaveBeenCalledWith(items[1]);
  });

  it("changes the series without touching the selected item", () => {
    const items = [item("a", ["series-a1", "series-a2"])];
    const { result } = setup(items);

    act(() => result.current.selectSeries(items[0].study.series[1]));

    expect(result.current.selectedSeries?.id).toBe("series-a2");
    expect(result.current.selectedQueueItem?.id).toBe("a");
  });

  it("has no series to show for an item that carries none", () => {
    const { result } = setup([item("a", [])]);

    expect(result.current.selectedQueueItem?.id).toBe("a");
    expect(result.current.selectedSeries).toBeNull();
  });

  it("stays on the same item when the queue is refreshed, taking the fresh copy", () => {
    const first = [item("a"), item("b")];
    const { result, rerender, onSelectItem } = setup(first);

    act(() => result.current.selectQueueItem(first[1]));
    onSelectItem.mockClear();

    const refreshed = [item("a"), item("b", ["series-1"], "updated findings")];
    rerender({ queueItems: refreshed });

    expect(result.current.selectedQueueItem?.id).toBe("b");
    expect(onSelectItem).toHaveBeenCalledWith(refreshed[1]);
    expect(onSelectItem.mock.calls[0][0].report.findingsText).toBe("updated findings");
  });

  it("falls back to the first item when the selected one leaves the worklist", () => {
    const { result, rerender } = setup([item("a"), item("b")]);

    act(() => result.current.selectQueueItem(item("b")));
    rerender({ queueItems: [item("c")] });

    expect(result.current.selectedQueueItem?.id).toBe("c");
  });

  it("keeps the selection when the queue empties rather than clearing the workspace", () => {
    const items = [item("a")];
    const { result, rerender } = setup(items);

    rerender({ queueItems: [] });

    expect(result.current.selectedQueueItem?.id).toBe("a");
  });
});
