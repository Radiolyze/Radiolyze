// 3D Volume Rendering (VRT) types

export interface TransferFunctionPoint {
  x: number; // HU value (Hounsfield Units)
  opacity: number; // 0-1
  color: [number, number, number]; // RGB 0-1
}

export interface TransferFunction {
  id: string;
  name: string;
  opacityPoints: Array<{ x: number; y: number }>; // HU -> opacity
  colorPoints: Array<{ x: number; r: number; g: number; b: number }>; // HU -> RGB
}

export interface VRTPreset {
  id: string;
  name: string;
  description: string;
  transferFunction: TransferFunction;
  ambient: number;
  diffuse: number;
  specular: number;
  specularPower: number;
}

// CT Hounsfield Unit ranges for reference:
// Air: -1000 HU
// Lung: -500 to -700 HU
// Fat: -100 to -50 HU
// Water: 0 HU
// Soft tissue: +40 to +80 HU
// Bone: +400 to +1000 HU
// Metal: +2000+ HU

export const VRT_PRESETS: VRTPreset[] = [
  {
    id: 'ct-bone',
    name: 'CT Bone',
    description: 'Optimiert für Knochenstrukturen',
    ambient: 0.2,
    diffuse: 0.9,
    specular: 0.3,
    specularPower: 15,
    transferFunction: {
      id: 'ct-bone-tf',
      name: 'CT Bone',
      opacityPoints: [
        { x: -1024, y: 0 },
        { x: 200, y: 0 },
        { x: 400, y: 0.5 },
        { x: 1000, y: 0.85 },
        { x: 2000, y: 0.95 },
        { x: 3071, y: 1.0 },
      ],
      colorPoints: [
        { x: -1024, r: 0, g: 0, b: 0 },
        { x: 200, r: 0.8, g: 0.5, b: 0.4 },
        { x: 400, r: 0.9, g: 0.8, b: 0.7 },
        { x: 1000, r: 1.0, g: 1.0, b: 0.9 },
        { x: 3071, r: 1.0, g: 1.0, b: 1.0 },
      ],
    },
  },
  {
    id: 'ct-lung',
    name: 'CT Lung',
    description: 'Optimiert für Lungenparenchym',
    ambient: 0.2,
    diffuse: 0.9,
    specular: 0.1,
    specularPower: 10,
    transferFunction: {
      id: 'ct-lung-tf',
      name: 'CT Lung',
      opacityPoints: [
        { x: -1024, y: 0 },
        { x: -900, y: 0.02 },
        { x: -700, y: 0.1 },
        { x: -500, y: 0.3 },
        { x: -200, y: 0.5 },
        { x: 0, y: 0.7 },
        { x: 500, y: 0.9 },
        { x: 3071, y: 1.0 },
      ],
      colorPoints: [
        { x: -1024, r: 0, g: 0, b: 0 },
        { x: -900, r: 0.1, g: 0.1, b: 0.2 },
        { x: -700, r: 0.3, g: 0.3, b: 0.5 },
        { x: -500, r: 0.5, g: 0.4, b: 0.6 },
        { x: -200, r: 0.8, g: 0.6, b: 0.5 },
        { x: 0, r: 0.9, g: 0.7, b: 0.6 },
        { x: 500, r: 1.0, g: 0.9, b: 0.8 },
        { x: 3071, r: 1.0, g: 1.0, b: 1.0 },
      ],
    },
  },
  {
    id: 'ct-soft-tissue',
    name: 'CT Soft Tissue',
    description: 'Weichteilgewebe und Organe',
    ambient: 0.3,
    diffuse: 0.8,
    specular: 0.2,
    specularPower: 10,
    transferFunction: {
      id: 'ct-soft-tissue-tf',
      name: 'CT Soft Tissue',
      opacityPoints: [
        { x: -1024, y: 0 },
        { x: -200, y: 0 },
        { x: -100, y: 0.1 },
        { x: 0, y: 0.3 },
        { x: 50, y: 0.5 },
        { x: 150, y: 0.7 },
        { x: 300, y: 0.85 },
        { x: 3071, y: 1.0 },
      ],
      colorPoints: [
        { x: -1024, r: 0, g: 0, b: 0 },
        { x: -200, r: 0.1, g: 0.05, b: 0 },
        { x: -100, r: 0.3, g: 0.15, b: 0.05 },
        { x: 0, r: 0.5, g: 0.3, b: 0.2 },
        { x: 50, r: 0.8, g: 0.5, b: 0.4 },
        { x: 150, r: 0.9, g: 0.7, b: 0.6 },
        { x: 300, r: 1.0, g: 0.9, b: 0.8 },
        { x: 3071, r: 1.0, g: 1.0, b: 1.0 },
      ],
    },
  },
  {
    id: 'ct-angiography',
    name: 'CT Angiography',
    description: 'Kontrastmittelgefüllte Gefäße',
    ambient: 0.2,
    diffuse: 0.9,
    specular: 0.5,
    specularPower: 25,
    transferFunction: {
      id: 'ct-angio-tf',
      name: 'CT Angiography',
      opacityPoints: [
        { x: -1024, y: 0 },
        { x: 100, y: 0 },
        { x: 150, y: 0.3 },
        { x: 250, y: 0.7 },
        { x: 400, y: 0.85 },
        { x: 1000, y: 0.95 },
        { x: 3071, y: 1.0 },
      ],
      colorPoints: [
        { x: -1024, r: 0, g: 0, b: 0 },
        { x: 100, r: 0.2, g: 0, b: 0 },
        { x: 150, r: 0.6, g: 0.1, b: 0.1 },
        { x: 250, r: 0.9, g: 0.2, b: 0.15 },
        { x: 400, r: 1.0, g: 0.4, b: 0.3 },
        { x: 1000, r: 1.0, g: 0.8, b: 0.6 },
        { x: 3071, r: 1.0, g: 1.0, b: 1.0 },
      ],
    },
  },
  {
    id: 'ct-muscle-bone',
    name: 'CT Muscle/Bone',
    description: 'Muskel- und Knochenstrukturen',
    ambient: 0.2,
    diffuse: 0.85,
    specular: 0.3,
    specularPower: 20,
    transferFunction: {
      id: 'ct-muscle-bone-tf',
      name: 'CT Muscle/Bone',
      opacityPoints: [
        { x: -1024, y: 0 },
        { x: -100, y: 0 },
        { x: 0, y: 0.15 },
        { x: 50, y: 0.35 },
        { x: 200, y: 0.55 },
        { x: 400, y: 0.75 },
        { x: 1000, y: 0.9 },
        { x: 3071, y: 1.0 },
      ],
      colorPoints: [
        { x: -1024, r: 0, g: 0, b: 0 },
        { x: -100, r: 0.2, g: 0.1, b: 0.05 },
        { x: 0, r: 0.5, g: 0.25, b: 0.15 },
        { x: 50, r: 0.7, g: 0.35, b: 0.25 },
        { x: 200, r: 0.85, g: 0.55, b: 0.45 },
        { x: 400, r: 0.95, g: 0.85, b: 0.75 },
        { x: 1000, r: 1.0, g: 0.95, b: 0.9 },
        { x: 3071, r: 1.0, g: 1.0, b: 1.0 },
      ],
    },
  },
];

export type VRTViewAngle = 'anterior' | 'posterior' | 'left' | 'right' | 'superior' | 'inferior';

export const VRT_VIEW_ANGLES: Record<VRTViewAngle, { position: [number, number, number]; viewUp: [number, number, number] }> = {
  anterior: { position: [0, -1, 0], viewUp: [0, 0, 1] },
  posterior: { position: [0, 1, 0], viewUp: [0, 0, 1] },
  left: { position: [1, 0, 0], viewUp: [0, 0, 1] },
  right: { position: [-1, 0, 0], viewUp: [0, 0, 1] },
  superior: { position: [0, 0, 1], viewUp: [0, -1, 0] },
  inferior: { position: [0, 0, -1], viewUp: [0, 1, 0] },
};

export interface VRTSettings {
  presetId: string;
  sampleDistance: number; // Rendering quality (lower = better quality, slower)
  ambient: number;
  diffuse: number;
  specular: number;
  specularPower: number;
}

export const DEFAULT_VRT_SETTINGS: VRTSettings = {
  presetId: 'ct-bone',
  sampleDistance: 1.0,
  ambient: 0.2,
  diffuse: 0.9,
  specular: 0.3,
  specularPower: 15,
};
