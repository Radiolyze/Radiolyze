import { 
  Move, 
  Ruler, 
  Sun, 
  ZoomIn,
  Square,
  Circle,
  Pencil,
  MoveHorizontal,
  ArrowUpRight,
} from 'lucide-react';
import type { ViewerToolConfig, AnnotationToolConfig } from '@/types/viewer';

export const viewerTools: ViewerToolConfig[] = [
  { id: 'zoom', icon: ZoomIn, label: 'Zoom', shortcut: 'Z' },
  { id: 'pan', icon: Move, label: 'Pan', shortcut: 'P' },
  { id: 'measure', icon: Ruler, label: 'Messen', shortcut: 'M' },
  { id: 'windowLevel', icon: Sun, label: 'Fenster/Level', shortcut: 'W' },
];

export const annotationTools: AnnotationToolConfig[] = [
  { id: 'rectangle', icon: Square, label: 'Bounding Box', shortcut: 'B', category: 'annotation' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse', shortcut: 'E', category: 'annotation' },
  { id: 'freehand', icon: Pencil, label: 'Freihand', shortcut: 'F', category: 'annotation' },
  { id: 'bidirectional', icon: MoveHorizontal, label: 'RECIST', shortcut: 'D', category: 'annotation' },
  { id: 'arrow', icon: ArrowUpRight, label: 'Annotation', shortcut: 'A', category: 'annotation' },
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
