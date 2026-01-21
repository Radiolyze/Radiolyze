// Types for viewport state synchronization between viewers

export interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
  windowLevel: { width: number; center: number };
}

export interface SyncOptions {
  frames: boolean;
  zoom: boolean;
  pan: boolean;
  windowLevel: boolean;
}

export type ViewportChangeHandler = (state: Partial<ViewportState>) => void;
