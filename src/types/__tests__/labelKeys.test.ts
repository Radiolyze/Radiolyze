import { describe, it, expect, afterAll } from "vitest";
import i18n from "@/i18n";
import { VRT_PRESETS } from "@/types/vrt";
import { MPR_VIEWPORTS, SLAB_BLEND_MODES } from "@/types/mpr";
import {
  ANNOTATION_CATEGORY_VALUES,
  ANNOTATION_SEVERITY_VALUES,
  ANNOTATION_LATERALITY_VALUES,
} from "@/types/annotations";

/**
 * The label tables in `src/types/*` used to carry German display strings, so a
 * language switch left the VRT preset descriptions, the MPR orientation labels
 * and the annotation categories in German (#117). They now carry only data, and
 * the components look each label up by value — which means a value added to one
 * of these lists without a matching translation renders the raw key to the
 * user.
 *
 * These tests walk every member of every list, in both languages, so that gap
 * fails here instead. Same contract shape as the export-format test in #233 and
 * the drift-metric test in #229.
 */

const languages = ["de", "en"] as const;

/** Resolves to "" when the key is missing, rather than echoing the key back. */
function translate(key: string): string {
  return i18n.t(key, { ns: "viewer", defaultValue: "" });
}

afterAll(async () => {
  await i18n.changeLanguage("de");
});

describe.each(languages)("viewer label keys in %s", (lng) => {
  it.each(VRT_PRESETS.map((preset) => preset.id))("describes VRT preset %s", async (id) => {
    await i18n.changeLanguage(lng);
    expect(translate(`vrt.presets.${id}`)).not.toBe("");
  });

  it.each(MPR_VIEWPORTS.map((viewport) => viewport.orientation))(
    "labels the %s viewport",
    async (orientation) => {
      await i18n.changeLanguage(lng);
      expect(translate(`mpr.orientation.${orientation}`)).not.toBe("");
    },
  );

  it.each(SLAB_BLEND_MODES)("labels the %s blend mode", async (mode) => {
    await i18n.changeLanguage(lng);
    expect(translate(`mpr.slab.blendMode.${mode}`)).not.toBe("");
  });

  it.each(ANNOTATION_CATEGORY_VALUES)("labels the %s category", async (category) => {
    await i18n.changeLanguage(lng);
    expect(translate(`annotations.category.${category}`)).not.toBe("");
  });

  it.each(ANNOTATION_SEVERITY_VALUES)("labels the %s severity", async (severity) => {
    await i18n.changeLanguage(lng);
    expect(translate(`annotations.severity.${severity}`)).not.toBe("");
  });

  it.each(ANNOTATION_LATERALITY_VALUES)("labels the %s laterality", async (laterality) => {
    await i18n.changeLanguage(lng);
    expect(translate(`annotations.laterality.${laterality}`)).not.toBe("");
  });
});

describe("viewer label formats", () => {
  it("keeps the slab indicator interpolated rather than spelling the unit out", () => {
    // MPRViewport and MPRToolbar both render this with a mode and a thickness;
    // a translation that drops a placeholder loses one of them silently.
    for (const lng of languages) {
      const indicator = i18n.getResource(lng, "viewer", "mpr.slab.indicator");
      expect(indicator).toContain("{{mode}}");
      expect(indicator).toContain("{{thickness}}");
    }
  });

  it("keeps the view-angle and tool shortcuts interpolated", () => {
    for (const lng of languages) {
      for (const key of ["vrt.viewAngleShortcut", "mpr.toolShortcut"]) {
        const pattern = i18n.getResource(lng, "viewer", key);
        expect(pattern).toContain("{{name}}");
        expect(pattern).toContain("{{shortcut}}");
      }
    }
  });
});
