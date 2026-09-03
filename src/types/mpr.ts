import type { Enums } from "@cornerstonejs/core";

export type MPROrientation = "axial" | "sagittal" | "coronal";

/**
 * No `label` here: the orientation *is* the label's key, resolved per render as
 * `viewer:mpr.orientations.${orientation}`. A label baked in at import time
 * would survive a language switch unchanged.
 */
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
 * Display order for the projection-mode buttons. The labels live under
 * `viewer:mpr.slab.blendModes.*` — MIP and MinIP keep their acronyms in both
 * languages, but "Normal" and "Average" do not.
 */
export const SLAB_BLEND_MODES: SlabBlendMode[] = ["composite", "mip", "minip", "average"];

/**
 * Slab thicknesses in mm. Rendered through `viewer:mpr.slab.thicknessMm`, which
 * carries the unit, so the millimetre suffix is translatable and the numbers
 * are not spelled out twice.
 */
export const SLAB_THICKNESS_PRESETS = [0, 5, 10, 20, 50, 100];
