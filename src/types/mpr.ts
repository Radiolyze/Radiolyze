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
 * The three planes, in display order. Their labels are looked up as
 * `viewer:mpr.orientation.<orientation>` at the render site rather than held
 * here -- see the note on VRT_PRESETS in ./vrt.ts (#117).
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

/** Selectable projection modes, in display order; labels via `viewer:mpr.slab.mode.<mode>`. */
export const SLAB_BLEND_MODES: SlabBlendMode[] = ["composite", "mip", "minip", "average"];

/** Slab thickness shortcuts in millimetres; 0 is the "thin" (single-slice) case. */
export const SLAB_THICKNESS_PRESETS = [0, 5, 10, 20, 50, 100];
