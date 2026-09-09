import { describe, it, expect, beforeEach, vi } from "vitest";
import { cloneElement, type ReactElement } from "react";

/** The LineChart that ResponsiveContainer wraps, sized explicitly. */
type ChartElement = ReactElement<{ width?: number | string; height?: number | string }>;
import { render, screen } from "@testing-library/react";
import { SnapshotChart } from "../Monitoring";
import type { DriftSnapshot } from "@/services/monitoringClient";
import "@/i18n";

// SnapshotChart is the only recharts consumer in the codebase and had no test
// at all, so a chart library upgrade could change what the monitoring page
// draws without a single assertion noticing. These tests were written against
// recharts 2 first and confirmed green there before the bump to 3, so what
// they pin is behaviour that survived the migration -- not the shape recharts
// 3 happens to produce.
//
// That is also why they assert on <text> contents and `.recharts-line-curve`
// rather than on dots or axis wrappers: recharts 3 renamed the axis classes
// and, under jsdom, renders dot elements that recharts 2 did not. Those are
// the parts that legitimately differ between the versions.
//
// One jsdom limit has to be worked around: ResponsiveContainer sizes itself
// from its parent and jsdom reports 0 for every measurement, so the real one
// renders an empty div and there is no chart to assert on. Fixed dimensions
// are the usual substitute; the LineChart, axes and formatters underneath are
// the real ones.
//
// The second workaround is only needed by the tooltip tests at the bottom:
// recharts opens tooltips from pointer geometry, zero under jsdom for the same
// reason, so mouse events never open one. `defaultIndex` opens it declaratively
// instead. It stays undefined -- and the Tooltip therefore untouched -- unless
// a test sets it.
let tooltipIndex: number | undefined;

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ChartElement }) =>
      cloneElement(children, { width: 400, height: 160 }),
    Tooltip: (props: Record<string, unknown>) => (
      <actual.Tooltip {...props} defaultIndex={tooltipIndex} />
    ),
  };
});

beforeEach(() => {
  tooltipIndex = undefined;
});

function snapshot(
  id: string,
  createdAt: string,
  confidenceAvg: number | null,
  passRate: number | null,
): DriftSnapshot {
  const inference = {
    count: 10,
    success_count: 10,
    failure_count: 0,
    failure_rate: 0,
    confidence_avg: confidenceAvg,
    confidence_median: confidenceAvg,
    confidence_min: confidenceAvg,
    confidence_max: confidenceAvg,
    latency_avg_ms: 120,
  };
  const qa = {
    count: 10,
    pass_count: 8,
    warn_count: 1,
    fail_count: 1,
    pass_rate: passRate,
    quality_score_avg: 0.9,
  };
  const window = { start: createdAt, end: createdAt };
  return {
    id,
    created_at: createdAt,
    window_days: 7,
    baseline_days: 7,
    payload: {
      window_days: 7,
      baseline_days: 7,
      window,
      baseline_window: window,
      current: { inference, qa },
      baseline: { inference, qa },
      delta: { inference: {}, qa: {} },
      alerts: [],
    },
  };
}

// The API returns snapshots newest first; SnapshotChart reverses them so the
// x axis reads left to right.
const SNAPSHOTS: DriftSnapshot[] = [
  snapshot("s3", "2026-03-03T00:00:00Z", 0.61, 0.72),
  snapshot("s2", "2026-03-02T00:00:00Z", 0.82, 0.9),
  snapshot("s1", "2026-03-01T00:00:00Z", 0.75, 0.8),
];

/** Day-of-month of every x axis label, in the order the chart drew them. */
function xAxisDays(container: HTMLElement): number[] {
  return (
    Array.from(container.querySelectorAll("text"))
      .map((node) => node.textContent ?? "")
      // The y axes are percentages ("0%" ... "100%"); the x axis carries dates.
      .filter((label) => !label.endsWith("%"))
      .map((label) => Number(label.match(/\d+/)?.[0]))
  );
}

describe("SnapshotChart", () => {
  it("renders a placeholder instead of an empty chart when there are no snapshots", () => {
    const { container } = render(<SnapshotChart snapshots={[]} />);

    expect(container.querySelectorAll(".recharts-surface")).toHaveLength(0);
    expect(screen.getByText(/snapshot/i)).toBeInTheDocument();
  });

  it("draws a confidence chart and a pass-rate chart", () => {
    const { container } = render(<SnapshotChart snapshots={SNAPSHOTS} />);

    expect(container.querySelectorAll(".recharts-surface")).toHaveLength(2);
    // One line per chart. This is the assertion that fails first if a chart
    // library upgrade stops rendering the series at all.
    expect(container.querySelectorAll(".recharts-line-curve")).toHaveLength(2);
  });

  it("orders the x axis oldest first, reversing the API's newest-first order", () => {
    const { container } = render(<SnapshotChart snapshots={SNAPSHOTS} />);

    // SNAPSHOTS is Mar 3, Mar 2, Mar 1; both charts must plot the reverse.
    expect(xAxisDays(container)).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it("keeps a snapshot with no pass rate on the axis and the line unbroken", () => {
    const withGap = [
      snapshot("s3", "2026-03-03T00:00:00Z", 0.61, 0.72),
      snapshot("s2", "2026-03-02T00:00:00Z", 0.82, null),
      snapshot("s1", "2026-03-01T00:00:00Z", 0.75, 0.8),
    ];
    const { container } = render(<SnapshotChart snapshots={withGap} />);

    // connectNulls: the gap costs neither an axis label nor the line.
    expect(xAxisDays(container)).toEqual([1, 2, 3, 1, 2, 3]);
    expect(container.querySelectorAll(".recharts-line-curve")).toHaveLength(2);
  });
});

// These two cover the lines the recharts 3 migration actually changed: the
// tooltip formatters, whose value argument recharts 3 widened from number to
// ValueType | undefined. Unlike the tests above they cannot run on recharts 2,
// which has no `defaultIndex` to open a tooltip without pointer geometry.
describe("SnapshotChart tooltips", () => {
  // Reversed order puts s2 -- confidence 0.82, pass rate 0.9 -- at index 1.
  const S2 = 1;

  it("formats the confidence tooltip as a percentage with one decimal", () => {
    tooltipIndex = S2;
    render(<SnapshotChart snapshots={SNAPSHOTS} />);

    expect(screen.getAllByText("82.0%").length).toBeGreaterThan(0);
  });

  it("does not scale the pass rate a second time", () => {
    tooltipIndex = S2;
    render(<SnapshotChart snapshots={SNAPSHOTS} />);

    // pass_rate 0.9 is already multiplied by 100 on the way into the chart, so
    // the formatter must print it as-is.
    expect(screen.getAllByText("90.0%").length).toBeGreaterThan(0);
    expect(screen.queryByText("9000.0%")).not.toBeInTheDocument();
  });
});
