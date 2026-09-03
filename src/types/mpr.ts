import type { Enums } from "@cornerstonejs/core";

export type MPROrientation = "axial" | "sagittal" | "coronal";

export interface MPRViewportConfig {
  id: string;
  orientation: MPROrientation;
  /**
   * i18n key of the viewport label, in the `viewer` namespace. A data table,
   * not markup — the key is resolved at the render site rather than through a
   * `useTranslation` in this module. Convention: `mpr.viewports.${orientation}`.
   */
  labelKey: string;
  color: string;
}

export interface MPRViewportState {
  axial: {
    sliceIndex: number;
    totalSlices: number;
  };
  sagittal: {
    sliceIndex: number;
    totalSlices: number;
  };
  coronal: {
    sliceIndex: number;
    totalSlices: number;
  };
}

export interface MPRCrosshairPosition {
  x: number;
  y: number;
  z: number;
}

export const MPR_VIEWPORTS: MPRViewportConfig[] = [
  {
    id: "axial",
    orientation: "axial",
    labelKey: "mpr.viewports.axial",
    color: "hsl(var(--chart-1))",
  },
  {
    id: "sagittal",
    orientation: "sagittal",
    labelKey: "mpr.viewports.sagittal",
    color: "hsl(var(--chart-2))",
  },
  {
    id: "coronal",
    orientation: "coronal",
    labelKey: "mpr.viewports.coronal",
    color: "hsl(var(--chart-3))",
  },
];

// Slab/MIP rendering modes
export type SlabBlendMode = "composite" | "mip" | "minip" | "average";

export interface SlabSettings {
  thickness: number; // in mm
  blendMode: SlabBlendMode;
}

/**
 * i18n keys of the blend-mode labels, in the `viewer` namespace. Resolved at the
 * render site — see the note on `MPRViewportConfig.labelKey`.
 */
export const SLAB_BLEND_MODE_LABEL_KEYS: Record<SlabBlendMode, string> = {
  composite: "mpr.slab.blendModes.composite",
  mip: "mpr.slab.blendModes.mip",
  minip: "mpr.slab.blendModes.minip",
  average: "mpr.slab.blendModes.average",
};

/**
 * Thickness shortcuts offered next to the slab slider, in millimetres.
 *
 * These carried a `label` string alongside the value ("5mm" next to `value: 5`),
 * which could drift from the number it described and hardcoded the unit in
 * German for the 0 case. The label is now derived from the value at the render
 * site through `mpr.slab.thicknessMm` / `mpr.slab.thicknessThin`.
 */
export const SLAB_THICKNESS_PRESETS: readonly number[] = [0, 5, 10, 20, 50, 100];
