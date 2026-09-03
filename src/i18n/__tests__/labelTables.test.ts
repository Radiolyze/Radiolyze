import { describe, it, expect, afterAll } from "vitest";
import i18n from "@/i18n";
import { VRT_PRESETS } from "@/types/vrt";
import { MPR_VIEWPORTS, SLAB_BLEND_MODE_LABEL_KEYS, SLAB_THICKNESS_PRESETS } from "@/types/mpr";
import type { SlabBlendMode } from "@/types/mpr";
import {
  ANNOTATION_CATEGORY_KEYS,
  ANNOTATION_SEVERITY_KEYS,
  ANNOTATION_LATERALITY_KEYS,
} from "@/types/annotations";
import type {
  AnnotationCategory,
  AnnotationSeverity,
  AnnotationLaterality,
} from "@/types/annotations";

/**
 * `src/types/{vrt,mpr,annotations}.ts` hold label *tables*, not markup, so they
 * carry i18n keys that the render sites resolve (#117). The failure mode that
 * buys is a key with no translation behind it, which renders the raw key —
 * `annotations.categories.nodule` — to the user, in every language, silently.
 *
 * These tests walk each table's members against the resources so adding a
 * preset, orientation, blend mode or category without translations fails here
 * instead of in the UI. Same contract shape as the export-format test #233 added
 * and the drift-metric test from #229.
 */

const LANGUAGES = ["de", "en"] as const;

/** Resolves in the `viewer` namespace, returning "" when the key is missing. */
async function resolve(lng: string, key: string): Promise<string> {
  await i18n.changeLanguage(lng);
  return i18n.t(key, { ns: "viewer", defaultValue: "" });
}

afterAll(async () => {
  await i18n.changeLanguage("de");
});

describe("VRT preset descriptions", () => {
  it("keys every preset by its id", () => {
    // The render site does not build the key, but keeping it derivable from the
    // id is what makes the resource file readable next to the table.
    for (const preset of VRT_PRESETS) {
      expect(preset.descriptionKey).toBe(`vrt.presets.${preset.id}`);
    }
  });

  it.each(LANGUAGES)("describes every preset in %s", async (lng) => {
    for (const preset of VRT_PRESETS) {
      expect(await resolve(lng, preset.descriptionKey), preset.id).not.toBe("");
    }
  });

  it.each(LANGUAGES)("labels every view angle in %s", async (lng) => {
    // VRTToolbar renders these as both the tooltip and the button's accessible
    // name, so a missing one leaves an icon button unnamed to a screen reader.
    const angles = ["anterior", "posterior", "left", "right", "superior", "inferior"];
    for (const angle of angles) {
      expect(await resolve(lng, `vrt.viewAngles.${angle}`), angle).not.toBe("");
    }
  });
});

describe("MPR label tables", () => {
  it("keys every viewport by its orientation", () => {
    for (const viewport of MPR_VIEWPORTS) {
      expect(viewport.labelKey).toBe(`mpr.viewports.${viewport.orientation}`);
    }
  });

  it.each(LANGUAGES)("labels every viewport in %s", async (lng) => {
    for (const viewport of MPR_VIEWPORTS) {
      expect(await resolve(lng, viewport.labelKey), viewport.id).not.toBe("");
    }
  });

  it.each(LANGUAGES)("labels every slab blend mode in %s", async (lng) => {
    const modes = Object.keys(SLAB_BLEND_MODE_LABEL_KEYS) as SlabBlendMode[];
    for (const mode of modes) {
      expect(await resolve(lng, SLAB_BLEND_MODE_LABEL_KEYS[mode]), mode).not.toBe("");
    }
  });

  it.each(LANGUAGES)("derives every thickness shortcut from its value in %s", async (lng) => {
    // The labels used to sit in the table as strings ("5mm" next to `value: 5`),
    // free to drift from the number. MPRToolbar now formats them from the value,
    // so the resource must keep the placeholder rather than spelling a number out.
    await i18n.changeLanguage(lng);
    expect(i18n.t("mpr.slab.thicknessThin", { ns: "viewer", defaultValue: "" })).not.toBe("");
    for (const thickness of SLAB_THICKNESS_PRESETS.filter((value) => value !== 0)) {
      expect(
        i18n.t("mpr.slab.thicknessMm", { ns: "viewer", value: thickness }),
        String(thickness),
      ).toContain(String(thickness));
    }
  });
});

describe("annotation label tables", () => {
  // Listing the union members rather than the record's keys: a member added to
  // the type without an entry in the table fails to compile, and one added to
  // both without a translation fails here.
  const categories: AnnotationCategory[] = [
    "nodule",
    "mass",
    "infiltrate",
    "effusion",
    "fracture",
    "lesion",
    "anatomical",
    "other",
  ];
  const severities: AnnotationSeverity[] = ["benign", "indeterminate", "malignant"];
  const lateralities: AnnotationLaterality[] = ["left", "right", "bilateral", "midline"];

  it.each(LANGUAGES)("labels every category in %s", async (lng) => {
    for (const category of categories) {
      expect(await resolve(lng, ANNOTATION_CATEGORY_KEYS[category]), category).not.toBe("");
    }
  });

  it.each(LANGUAGES)("labels every severity in %s", async (lng) => {
    for (const severity of severities) {
      expect(await resolve(lng, ANNOTATION_SEVERITY_KEYS[severity]), severity).not.toBe("");
    }
  });

  it.each(LANGUAGES)("labels every laterality in %s", async (lng) => {
    for (const laterality of lateralities) {
      expect(await resolve(lng, ANNOTATION_LATERALITY_KEYS[laterality]), laterality).not.toBe("");
    }
  });

  it("covers every member the tables declare", () => {
    // Guards the lists above against the type gaining a member that this file
    // then silently stops checking.
    expect(Object.keys(ANNOTATION_CATEGORY_KEYS).sort()).toEqual([...categories].sort());
    expect(Object.keys(ANNOTATION_SEVERITY_KEYS).sort()).toEqual([...severities].sort());
    expect(Object.keys(ANNOTATION_LATERALITY_KEYS).sort()).toEqual([...lateralities].sort());
  });
});
