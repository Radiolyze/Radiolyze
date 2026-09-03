import { describe, it, expect } from "vitest";
import i18n from "@/i18n";
import {
  ANNOTATION_CATEGORY_VALUES,
  ANNOTATION_LATERALITY_VALUES,
  ANNOTATION_SEVERITY_VALUES,
} from "@/types/annotations";
import { MPR_VIEWPORTS, SLAB_BLEND_MODES, SLAB_THICKNESS_PRESETS } from "@/types/mpr";
import { VRT_PRESETS, VRT_VIEW_ANGLES } from "@/types/vrt";

/**
 * The label tables in `src/types/*` used to carry German strings, so a language
 * switch left them behind and an English user read German preset descriptions,
 * orientations and annotation categories. The tables now carry only the values;
 * the labels live in the `viewer` namespace and are resolved at the render site.
 *
 * That moves the failure mode: a value added to a table without a matching
 * translation renders the raw key. These tests walk each table in both
 * languages so that fails here instead — the same contract shape as the export
 * formats in resources.test.ts.
 */

/** `t` returns the key itself when nothing resolves, so an empty default separates the two. */
async function resolve(lng: string, key: string): Promise<string> {
  await i18n.changeLanguage(lng);
  return i18n.t(key, { defaultValue: "" });
}

const languages = ["de", "en"];

describe("VRT preset labels", () => {
  it.each(languages)("describes every preset in %s", async (lng) => {
    for (const preset of VRT_PRESETS) {
      expect(await resolve(lng, `viewer:vrt.presets.${preset.id}`), preset.id).not.toBe("");
    }
  });

  it.each(languages)("labels every view angle in %s", async (lng) => {
    for (const angle of Object.keys(VRT_VIEW_ANGLES)) {
      expect(await resolve(lng, `viewer:vrt.viewAngles.${angle}`), angle).not.toBe("");
    }
  });

  it("keeps the protocol name on the preset itself", () => {
    // The name is the CT protocol ("CT Bone"), identical in both languages, so
    // it stays data. Only the description is translated.
    expect(VRT_PRESETS.map((p) => p.name)).toContain("CT Bone");
  });
});

describe("MPR label tables", () => {
  it.each(languages)("labels every viewport orientation in %s", async (lng) => {
    for (const viewport of MPR_VIEWPORTS) {
      const key = `viewer:mpr.orientations.${viewport.orientation}`;
      expect(await resolve(lng, key), viewport.orientation).not.toBe("");
    }
  });

  it.each(languages)("labels every slab blend mode and its hint in %s", async (lng) => {
    for (const mode of SLAB_BLEND_MODES) {
      expect(await resolve(lng, `viewer:mpr.slab.blendModes.${mode}`), mode).not.toBe("");
    }
    // "composite" is the off state and has no explanatory hint in the popover.
    for (const mode of SLAB_BLEND_MODES.filter((m) => m !== "composite")) {
      expect(await resolve(lng, `viewer:mpr.slab.hints.${mode}`), mode).not.toBe("");
    }
  });

  it.each(languages)("carries the millimetre unit in the resource in %s", async (lng) => {
    await i18n.changeLanguage(lng);
    // The presets are bare numbers, so the unit has to come from the
    // translation — spelling "5mm" into the table is what this replaced.
    expect(SLAB_THICKNESS_PRESETS).toContain(5);
    expect(i18n.t("viewer:mpr.slab.thicknessMm", { value: 5 })).toContain("5");
    expect(i18n.t("viewer:mpr.slab.thicknessMm", { value: 5 })).toContain("mm");
    expect(i18n.t("viewer:mpr.slab.thicknessNone")).not.toBe("");
  });
});

describe("annotation label tables", () => {
  const tables = [
    ["categories", ANNOTATION_CATEGORY_VALUES],
    ["severities", ANNOTATION_SEVERITY_VALUES],
    ["lateralities", ANNOTATION_LATERALITY_VALUES],
  ] as const;

  it.each(languages)("labels every member of every table in %s", async (lng) => {
    for (const [group, values] of tables) {
      for (const value of values) {
        const key = `viewer:annotations.${group}.${value}`;
        expect(await resolve(lng, key), key).not.toBe("");
      }
    }
  });

  it("has no label left over for a value the type no longer has", async () => {
    await i18n.changeLanguage("en");
    for (const [group, values] of tables) {
      const translated = Object.keys(
        i18n.getResourceBundle("en", "viewer").annotations[group] as Record<string, string>,
      );
      expect(translated.sort()).toEqual([...values].sort());
    }
  });
});
