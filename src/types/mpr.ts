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

// Display names live in the `viewer` resources under `mpr.orientations.*` and are
// resolved at the render site — a `useTranslation` handle in a type module cannot
// see a language switch. Same treatment as the export formats in #233.
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

/** Every member of `SlabBlendMode`, in the order the toolbar offers them. */
export const SLAB_BLEND_MODES: SlabBlendMode[] = ["composite", "mip", "minip", "average"];

/** Thickness shortcuts in mm. Rendered through `mpr.slab.thickness*`. */
export const SLAB_THICKNESS_PRESETS = [0, 5, 10, 20, 50, 100];
