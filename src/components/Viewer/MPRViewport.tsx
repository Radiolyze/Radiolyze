import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import type { MPRViewportConfig, SlabSettings } from '@/types/mpr';
import { SLAB_BLEND_MODE_LABELS } from '@/types/mpr';

interface MPRViewportProps {
  config: MPRViewportConfig;
  sliceIndex: number;
  totalSlices: number;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
  slabSettings?: SlabSettings;
}

export const MPRViewport = forwardRef<HTMLDivElement, MPRViewportProps>(
  ({ config, sliceIndex, totalSlices, isActive, onClick, className, slabSettings }, ref) => {
    const isSlabActive = slabSettings && slabSettings.thickness > 0;
    
    return (
      <div
        className={cn(
          'relative bg-black rounded-lg overflow-hidden border-2 transition-colors',
          isActive ? 'border-primary' : 'border-border/50',
          className
        )}
        onClick={onClick}
      >
        {/* Viewport canvas */}
        <div
          ref={ref}
          className="absolute inset-0 cursor-crosshair"
        />

        {/* Orientation label */}
        <div
          className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded text-xs font-semibold"
          style={{ backgroundColor: config.color, color: 'black' }}
        >
          {config.label}
        </div>

        {/* Slab indicator */}
        {isSlabActive && (
          <div className="absolute top-2 right-2 z-10 bg-accent text-accent-foreground px-2 py-0.5 rounded text-xs font-semibold">
            {SLAB_BLEND_MODE_LABELS[slabSettings.blendMode]} {slabSettings.thickness}mm
          </div>
        )}

        {/* Slice info */}
        {totalSlices > 0 && (
          <div className="absolute bottom-2 left-2 z-10 bg-black/70 px-2 py-1 rounded text-xs text-muted-foreground">
            {sliceIndex + 1} / {totalSlices}
          </div>
        )}

        {/* Orientation markers */}
        <div className="absolute top-1/2 left-2 z-10 text-xs text-muted-foreground/60 -translate-y-1/2">
          {config.orientation === 'axial' && 'R'}
          {config.orientation === 'sagittal' && 'A'}
          {config.orientation === 'coronal' && 'R'}
        </div>
        <div className="absolute top-1/2 right-2 z-10 text-xs text-muted-foreground/60 -translate-y-1/2">
          {config.orientation === 'axial' && 'L'}
          {config.orientation === 'sagittal' && 'P'}
          {config.orientation === 'coronal' && 'L'}
        </div>
        <div className="absolute top-2 left-1/2 z-10 text-xs text-muted-foreground/60 -translate-x-1/2">
          {config.orientation === 'axial' && 'A'}
          {config.orientation === 'sagittal' && 'S'}
          {config.orientation === 'coronal' && 'S'}
        </div>
        <div className="absolute bottom-2 left-1/2 z-10 text-xs text-muted-foreground/60 -translate-x-1/2">
          {config.orientation === 'axial' && 'P'}
          {config.orientation === 'sagittal' && 'I'}
          {config.orientation === 'coronal' && 'I'}
        </div>
      </div>
    );
  }
);

MPRViewport.displayName = 'MPRViewport';
