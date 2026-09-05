import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImpressionPanel } from "../ImpressionPanel";
import "@/i18n";

function renderPanel(props: Partial<Parameters<typeof ImpressionPanel>[0]> = {}) {
  return render(
    <ImpressionPanel
      impression="Kein Anhalt für ein Infiltrat."
      findings="Befund"
      qaStatus="pass"
      qaWarnings={[]}
      onImpressionChange={vi.fn()}
      onGenerateImpression={vi.fn().mockResolvedValue(undefined)}
      onApprove={vi.fn()}
      {...props}
    />,
  );
}

/** The approve button is the trigger of the ApprovalDialog. */
function approveButton() {
  return screen.getByRole("button", { name: /approve & finalize|already approved/i });
}

beforeEach(() => {
  localStorage.clear();
});

describe("ImpressionPanel approval gating", () => {
  it("allows approval for a draft report that passed QA", () => {
    renderPanel({ reportStatus: "draft" });

    expect(approveButton()).toBeEnabled();
    expect(screen.queryByTestId("impression-finalized-notice")).not.toBeInTheDocument();
  });

  it("disables approval once the report is finalized", () => {
    renderPanel({ reportStatus: "finalized" });

    expect(approveButton()).toBeDisabled();
  });

  it("names the approver and the approval time on a finalized report", () => {
    renderPanel({
      reportStatus: "finalized",
      approvedBy: "Dr. Meier",
      approvedAt: "2026-09-03T08:30:00Z",
    });

    const notice = screen.getByTestId("impression-finalized-notice");
    expect(notice).toHaveTextContent("Dr. Meier");
    expect(notice).toHaveTextContent("2026");
  });

  it("still shows the finalized state without approval metadata", () => {
    renderPanel({ reportStatus: "finalized" });

    expect(screen.getByTestId("impression-finalized-notice")).toHaveTextContent(
      "Report is approved",
    );
  });

  it("keeps approval disabled when QA failed", () => {
    renderPanel({ reportStatus: "draft", qaStatus: "fail" });

    expect(approveButton()).toBeDisabled();
  });

  it("keeps approval disabled without an impression", () => {
    renderPanel({ reportStatus: "draft", impression: "" });

    expect(approveButton()).toBeDisabled();
  });
});
