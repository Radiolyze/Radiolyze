import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import i18n from "@/i18n";
import { AIFindingsOverlay } from "@/components/Viewer/AIFindingsOverlay";
import type { FindingBox } from "@/types/radiology";

// The stroke each category paints its box with (AIFindingsOverlay's
// CATEGORY_COLORS). Asserting on the colour rather than on a class name is
// deliberate: the colour *is* the classification the radiologist reads.
const PATHOLOGICAL_STROKE = "rgba(239, 68, 68, 0.95)";
const ANATOMICAL_STROKE = "rgba(6, 182, 212, 0.90)";
const OTHER_STROKE = "rgba(245, 158, 11, 0.90)";

const box = (overrides: Partial<FindingBox>): FindingBox => ({
  box_2d: [100, 100, 300, 300],
  label: "Finding",
  ...overrides,
});

/** The stroke of the box rect (the first rect in each finding group). */
const strokesOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("svg > g")).map((group) =>
    group.querySelector("rect")?.getAttribute("stroke"),
  );

describe("AIFindingsOverlay", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("colours each box by the category the model supplied", () => {
    const { container } = render(
      <AIFindingsOverlay
        findings={[
          box({ label: "Consolidation", category: "pathological" }),
          box({ label: "Right lung", category: "anatomical" }),
          box({ label: "Support device", category: "other" }),
        ]}
      />,
    );

    expect(strokesOf(container)).toEqual([PATHOLOGICAL_STROKE, ANATOMICAL_STROKE, OTHER_STROKE]);
  });

  it("takes the category over a label that matches the other keyword list", () => {
    // A finding the keyword fallback would have called anatomical ("lung"),
    // categorized as pathological by the model. The model wins.
    const { container } = render(
      <AIFindingsOverlay findings={[box({ label: "Lung mass", category: "pathological" })]} />,
    );

    expect(strokesOf(container)).toEqual([PATHOLOGICAL_STROKE]);
  });

  it("falls back to the label for a finding stored without a category", () => {
    const { container } = render(
      <AIFindingsOverlay
        findings={[
          box({ label: "Rundherd rechts apikal" }),
          box({ label: "Mediastinum" }),
          // In neither keyword list -- the case the fallback cannot answer, and
          // the reason the category exists at all.
          box({ label: "Pneumothorax" }),
        ]}
      />,
    );

    expect(strokesOf(container)).toEqual([PATHOLOGICAL_STROKE, ANATOMICAL_STROKE, OTHER_STROKE]);
  });

  it("names the category in words next to the label", () => {
    const { container } = render(
      <AIFindingsOverlay findings={[box({ label: "Consolidation", category: "pathological" })]} />,
    );

    expect(container.querySelector("title")?.textContent).toBe(
      "Consolidation — Pathological finding",
    );
  });

  it("renders nothing without findings", () => {
    const { container } = render(<AIFindingsOverlay findings={[]} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("counts the findings in the overlay's accessible name, in the UI language", async () => {
    const findings = [box({ category: "pathological" }), box({ category: "anatomical" })];
    const { container, rerender } = render(<AIFindingsOverlay findings={findings} />);
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toBe("2 AI findings");

    await i18n.changeLanguage("de");
    rerender(<AIFindingsOverlay findings={findings} />);
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toBe("2 KI-Befunde");
  });
});
