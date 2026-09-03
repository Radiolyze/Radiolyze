import { describe, it, expect } from "vitest";
import i18n, { resources } from "@/i18n";
import type { ExportFormat } from "@/services/trainingClient";
import { VRT_PRESETS } from "@/types/vrt";
import { MPR_VIEWPORTS, SLAB_BLEND_MODE_KEYS, SLAB_THICKNESS_PRESETS } from "@/types/mpr";
import { ANNOTATION_CATEGORY_KEYS } from "@/types/annotations";

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

describe("DICOMweb settings resources", () => {
  it("keeps the markup the url hint renders through <Trans>", () => {
    // Rendered with components={{ path: <span className="font-mono" /> }} — a
    // translation that loses the tag would drop the path out of the sentence.
    for (const lng of ["de", "en"] as const) {
      expect(resources[lng].settings.dicomweb.urlHint).toContain("<path>/dicom-web</path>");
    }
  });
});

describe("viewer label tables", () => {
  // The tables in src/types/{vrt,mpr,annotations}.ts hold translation keys
  // rather than labels — a type module has nowhere to look a translation up.
  // Nothing in the type system ties a key to a resource, so an entry added
  // without its translation would render the raw key to the user. These walk
  // the tables so that fails here instead.
  const tables: Array<[string, string[]]> = [
    ["VRT preset descriptions", VRT_PRESETS.map((preset) => preset.descriptionKey)],
    ["MPR viewport labels", MPR_VIEWPORTS.map((viewport) => viewport.labelKey)],
    ["slab blend modes", Object.values(SLAB_BLEND_MODE_KEYS)],
    ["annotation categories", Object.values(ANNOTATION_CATEGORY_KEYS)],
  ];

  for (const [table, keys] of tables) {
    it.each(["de", "en"])(`resolves every key of the ${table} in %s`, async (lng) => {
      await i18n.changeLanguage(lng);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(i18n.t(`viewer:${key}`, { defaultValue: "" })).not.toBe("");
      }
    });
  }

  it("counts images rather than spelling one plural out", async () => {
    // Both keys carry {{count}}, so i18next selects a plural form; a resource
    // written without the _one/_other pair renders "1 Bilder".
    await i18n.changeLanguage("de");
    expect(i18n.t("viewer:vrt.imageCount", { count: 1 })).toBe("1 Bild");
    expect(i18n.t("viewer:vrt.imageCount", { count: 12 })).toBe("12 Bilder");
    expect(i18n.t("viewer:mpr.seriesSummary", { modality: "CT", count: 1 })).toBe("CT • 1 Bild");

    await i18n.changeLanguage("en");
    expect(i18n.t("viewer:vrt.imageCount", { count: 1 })).toBe("1 image");
    expect(i18n.t("viewer:mpr.seriesSummary", { modality: "CT", count: 12 })).toBe(
      "CT • 12 images",
    );
  });

  it("carries the slab thickness as an interpolated value", () => {
    // SLAB_THICKNESS_PRESETS is millimetres only; the labels used to spell the
    // same numbers out a second time and could drift from the values.
    expect(SLAB_THICKNESS_PRESETS).toContain(0);
    for (const lng of ["de", "en"] as const) {
      expect(resources[lng].viewer.mpr.slab.thicknessValue).toContain("{{value}}");
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
