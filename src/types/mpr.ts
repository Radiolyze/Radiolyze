import type { Enums } from '@cornerstonejs/core';

export type MPROrientation = 'axial' | 'sagittal' | 'coronal';

export interface MPRViewportConfig {
  id: string;
  orientation: MPROrientation;
  label: string;
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
  { id: 'axial', orientation: 'axial', label: 'Axial', color: 'hsl(var(--chart-1))' },
  { id: 'sagittal', orientation: 'sagittal', label: 'Sagittal', color: 'hsl(var(--chart-2))' },
  { id: 'coronal', orientation: 'coronal', label: 'Coronal', color: 'hsl(var(--chart-3))' },
];

// Slab/MIP rendering modes
export type SlabBlendMode = 'composite' | 'mip' | 'minip' | 'average';

export interface SlabSettings {
  thickness: number; // in mm
  blendMode: SlabBlendMode;
}

export const SLAB_BLEND_MODE_LABELS: Record<SlabBlendMode, string> = {
  composite: 'Normal',
  mip: 'MIP',
  minip: 'MinIP',
  average: 'Average',
};

export const SLAB_THICKNESS_PRESETS = [
  { value: 0, label: 'Dünn (0mm)' },
  { value: 5, label: '5mm' },
  { value: 10, label: '10mm' },
  { value: 20, label: '20mm' },
  { value: 50, label: '50mm' },
  { value: 100, label: '100mm' },
];
