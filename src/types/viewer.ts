import type { LucideIcon } from 'lucide-react';

// Base viewer tools (navigation)
export type ViewerToolId = 'zoom' | 'pan' | 'measure' | 'windowLevel';

// Annotation tools for training data
export type AnnotationToolId = 'rectangle' | 'ellipse' | 'freehand' | 'bidirectional' | 'arrow';

// Combined tool types
export type AllToolId = ViewerToolId | AnnotationToolId;

export interface ViewerToolConfig {
  id: ViewerToolId;
  icon: LucideIcon;
  label: string;
  shortcut?: string;
}

export interface AnnotationToolConfig {
  id: AnnotationToolId;
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  category: 'annotation';
}

export type AnyToolConfig = ViewerToolConfig | AnnotationToolConfig;
