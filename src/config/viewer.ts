import { Move, Ruler, Sun, ZoomIn } from 'lucide-react';
import type { ViewerToolConfig } from '@/types/viewer';

export const viewerTools: ViewerToolConfig[] = [
  { id: 'zoom', icon: ZoomIn, label: 'Zoom', shortcut: 'Z' },
  { id: 'pan', icon: Move, label: 'Pan', shortcut: 'P' },
  { id: 'measure', icon: Ruler, label: 'Messen', shortcut: 'M' },
  { id: 'windowLevel', icon: Sun, label: 'Fenster/Level', shortcut: 'W' },
];

export interface WindowLevelPreset {
  id: string;
  label: string;
  windowWidth?: number;
  windowCenter?: number;
}

export const windowLevelPresets: WindowLevelPreset[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'ct-soft', label: 'CT Weichteil', windowWidth: 400, windowCenter: 40 },
  { id: 'ct-lung', label: 'CT Lunge', windowWidth: 1500, windowCenter: -600 },
  { id: 'ct-bone', label: 'CT Knochen', windowWidth: 2500, windowCenter: 480 },
  { id: 'ct-brain', label: 'CT Gehirn', windowWidth: 80, windowCenter: 40 },
  { id: 'ct-abdomen', label: 'CT Abdomen', windowWidth: 350, windowCenter: 50 },
];
