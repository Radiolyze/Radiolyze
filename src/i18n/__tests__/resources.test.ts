import { describe, it, expect } from "vitest";
import i18n, { resources } from "@/i18n";
import type { ExportFormat } from "@/services/trainingClient";

type Resource = Record<string, unknown>;

function flattenKeys(node: Resource, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" ? flattenKeys(value as Resource, path) : [path];
  });
}

const namespaces = Object.keys(resources.de) as Array<keyof typeof resources.de>;

describe("translation resources", () => {
  it.each(namespaces)("%s carries the same keys in German and English", (ns) => {
    const de = flattenKeys(resources.de[ns] as Resource).sort();
    const en = flattenKeys(resources.en[ns] as Resource).sort();
    expect(de).toEqual(en);
  });

  it("resolves German plurals for prior-report counts", async () => {
    await i18n.changeLanguage("de");
    expect(i18n.t("report:priorComparison.count", { count: 1 })).toBe("1 Vorbefund");
    expect(i18n.t("report:priorComparison.count", { count: 3 })).toBe("3 Vorbefunde");
  });

  it("resolves English plurals for prior-report counts", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("report:priorComparison.count", { count: 1 })).toBe("1 prior report");
    expect(i18n.t("report:priorComparison.count", { count: 3 })).toBe("3 prior reports");
  });
});

describe("training export resources", () => {
  it("resolves the counted strings in both languages", async () => {
    await i18n.changeLanguage("de");
    expect(i18n.t("training:dataCapture.catalogCount", { count: 1 })).toBe("1 Bild im Katalog");
    expect(i18n.t("training:dataCapture.catalogCount", { count: 4 })).toBe("4 Bilder im Katalog");
    expect(i18n.t("training:export.readySummary", { count: 1, format: "COCO" })).toBe(
      "1 Annotation im Format COCO",
    );

    await i18n.changeLanguage("en");
    expect(i18n.t("training:dataCapture.catalogCount", { count: 1 })).toBe(
      "1 image in the catalogue",
    );
    expect(i18n.t("training:export.readySummary", { count: 4, format: "COCO" })).toBe(
      "4 annotations in COCO format",
    );
  });

  it("keeps the markup the export hint renders through <Trans>", () => {
    // Rendered with components={{ code: <code /> }} — a translation that loses
    // the tag would silently drop the file path from the sentence.
    for (const lng of ["de", "en"] as const) {
      expect(resources[lng].training.export.zipHint).toContain("<code>images/manifest.json</code>");
    }
  });

  // Training.tsx looks the description up as `formats.${format}`, so a format
  // added to ExportFormat without a matching key renders the raw key to the
  // user. This list is the type's members — extending one without the other
  // fails here rather than in the UI.
  const formats: ExportFormat[] = ["coco", "huggingface", "radiolyze"];

  it.each(["de", "en"])("describes every export format in %s", async (lng) => {
    await i18n.changeLanguage(lng);
    for (const format of formats) {
      expect(i18n.t(`training:formats.${format}`, { defaultValue: "" })).not.toBe("");
    }
  });

  it("carries the split bounds as an interpolated percentage", () => {
    // The percentages come from SPLIT_MIN/SPLIT_MAX in the component, so the
    // resource must keep the placeholder rather than spelling a number out.
    for (const lng of ["de", "en"] as const) {
      expect(resources[lng].training.settings.splitBound).toContain("{{percent}}");
    }
  });
});

describe("drift alert metric labels", () => {
  // The identifiers the backend puts on each alert (backend/app/api/monitoring.py).
  // They are dotted, so they resolve straight through the nesting under
  // monitoring.alerts.metrics — a rename on either side breaks this test rather
  // than silently rendering a raw identifier to the user.
  const metrics = [
    "inference.confidence_avg",
    "inference.failure_rate",
    "qa.pass_rate",
    "qa.quality_score_avg",
  ];

  it.each(["de", "en"])("labels every backend drift metric in %s", async (lng) => {
    await i18n.changeLanguage(lng);
    for (const metric of metrics) {
      const label = i18n.t(`common:monitoring.alerts.metrics.${metric}`, {
        defaultValue: metric,
      });
      expect(label).not.toBe(metric);
    }
  });

  it("falls back to the raw identifier for an unknown metric", async () => {
    await i18n.changeLanguage("en");
    expect(
      i18n.t("common:monitoring.alerts.metrics.inference.made_up", {
        defaultValue: "inference.made_up",
      }),
    ).toBe("inference.made_up");
  });

  it("resolves monitoring plurals in both languages", async () => {
    await i18n.changeLanguage("de");
    expect(i18n.t("common:monitoring.alerts.title", { count: 1 })).toBe("Aktive Drift-Warnung (1)");
    expect(i18n.t("common:monitoring.alerts.title", { count: 2 })).toBe(
      "Aktive Drift-Warnungen (2)",
    );
    expect(i18n.t("common:monitoring.history.subtitle", { count: 1 })).toBe(
      "Basierend auf 1 gespeicherten Snapshot",
    );

    await i18n.changeLanguage("en");
    expect(i18n.t("common:monitoring.alerts.title", { count: 1 })).toBe("Active drift alert (1)");
    expect(i18n.t("common:monitoring.alerts.title", { count: 2 })).toBe("Active drift alerts (2)");
    expect(i18n.t("common:monitoring.history.subtitle", { count: 2 })).toBe(
      "Based on 2 saved snapshots",
    );
  });
});
