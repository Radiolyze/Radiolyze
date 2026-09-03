export type MPROrientation = "axial" | "sagittal" | "coronal";

export interface MPRViewportConfig {
  id: string;
  orientation: MPROrientation;
  /** Key into the `viewer` namespace, resolved where the viewport is rendered. */
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
    labelKey: "mpr.orientation.axial",
    color: "hsl(var(--chart-1))",
  },
  {
    id: "sagittal",
    orientation: "sagittal",
    labelKey: "mpr.orientation.sagittal",
    color: "hsl(var(--chart-2))",
  },
  {
    id: "coronal",
    orientation: "coronal",
    labelKey: "mpr.orientation.coronal",
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
 * Keys into the `viewer` namespace, resolved where a blend mode is rendered.
 * The mode names are acronyms in both languages, but `composite` is not, and a
 * label table in a type module has no place to look a translation up.
 */
export const SLAB_BLEND_MODE_KEYS: Record<SlabBlendMode, string> = {
  composite: "mpr.slab.blendMode.composite",
  mip: "mpr.slab.blendMode.mip",
  minip: "mpr.slab.blendMode.minip",
  average: "mpr.slab.blendMode.average",
};

/**
 * Millimetres only — the labels used to spell the same numbers out a second
 * time, so a preset could be changed here and still render its old value.
 */
export const SLAB_THICKNESS_PRESETS = [0, 5, 10, 20, 50, 100];
