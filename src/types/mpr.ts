import type { Enums } from "@cornerstonejs/core";

export type MPROrientation = "axial" | "sagittal" | "coronal";

export interface MPRViewportConfig {
  id: string;
  orientation: MPROrientation;
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

/**
 * Layout of the three MPR viewports. Display labels live in the resources as
 * `viewer:mpr.orientation.<orientation>` and are resolved where the viewport
 * renders, not stored here — "Coronal" is "Koronar" in German, and a module
 * constant cannot see the active language.
 */
export const MPR_VIEWPORTS: MPRViewportConfig[] = [
  { id: "axial", orientation: "axial", color: "hsl(var(--chart-1))" },
  { id: "sagittal", orientation: "sagittal", color: "hsl(var(--chart-2))" },
  { id: "coronal", orientation: "coronal", color: "hsl(var(--chart-3))" },
];

// Slab/MIP rendering modes
export type SlabBlendMode = "composite" | "mip" | "minip" | "average";

export interface SlabSettings {
  thickness: number; // in mm
  blendMode: SlabBlendMode;
}

/**
 * Every blend mode, in the order the toolbar offers them. Labels are resolved
 * as `viewer:mpr.slab.blendMode.<mode>`; a mode added here without a matching
 * key fails the contract test in `src/types/__tests__/labelKeys.test.ts`.
 */
export const SLAB_BLEND_MODES: SlabBlendMode[] = ["composite", "mip", "minip", "average"];

/** Slab thickness shortcuts in mm. `0` renders as the "thin" label, the rest as `{{mm}}mm`. */
export const SLAB_THICKNESS_PRESETS = [0, 5, 10, 20, 50, 100];
