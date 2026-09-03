import { describe, it, expect } from "vitest";
import { extractInferenceFindings } from "@/hooks/reporting/inferenceHelpers";

describe("extractInferenceFindings", () => {
  it("carries the category the backend published", () => {
    const findings = extractInferenceFindings({
      findings: [
        { box_2d: [1, 2, 3, 4], label: "Consolidation", category: "pathological" },
        { box_2d: [5, 6, 7, 8], label: "Right lung", category: "anatomical" },
      ],
    });

    expect(findings?.map((f) => f.category)).toEqual(["pathological", "anatomical"]);
  });

  it("keeps the box and drops the category when the value is not one we know", () => {
    // A category outside the union would reach getBoxColors as a colourless
    // key; the box is still worth rendering, so only the hint goes.
    const findings = extractInferenceFindings({
      findings: [
        { box_2d: [1, 2, 3, 4], label: "Nodule", category: "suspicious" },
        { box_2d: [1, 2, 3, 4], label: "Nodule", category: 7 },
        { box_2d: [1, 2, 3, 4], label: "Nodule" },
      ],
    });

    expect(findings).toHaveLength(3);
    expect(findings?.every((f) => f.category === undefined)).toBe(true);
  });

  it("still rejects a finding without a usable box or label", () => {
    const findings = extractInferenceFindings({
      findings: [
        { box_2d: [1, 2, 3], label: "Too short", category: "pathological" },
        { box_2d: [1, 2, 3, 4], label: "  ", category: "pathological" },
        { box_2d: [1, 2, 3, 4], label: "Kept", category: "pathological", confidence: 0.8 },
      ],
    });

    expect(findings).toEqual([
      {
        box_2d: [1, 2, 3, 4],
        label: "Kept",
        confidence: 0.8,
        category: "pathological",
      },
    ]);
  });

  it("returns undefined for an empty or absent finding list", () => {
    expect(extractInferenceFindings({ findings: [] })).toBeUndefined();
    expect(extractInferenceFindings({})).toBeUndefined();
    expect(extractInferenceFindings(null)).toBeUndefined();
  });
});
