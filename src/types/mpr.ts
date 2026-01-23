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
