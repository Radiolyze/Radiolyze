import type { LucideIcon } from 'lucide-react';

export type ViewerToolId = 'zoom' | 'pan' | 'measure' | 'windowLevel';

export interface ViewerToolConfig {
  id: ViewerToolId;
  icon: LucideIcon;
  label: string;
  shortcut?: string;
}
