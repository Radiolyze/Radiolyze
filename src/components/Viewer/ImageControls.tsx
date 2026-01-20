import type { LucideIcon } from 'lucide-react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ViewerToolConfig {
  id: string;
  icon: LucideIcon;
  label: string;
  shortcut?: string;
}

interface ImageControlsProps {
  tools: ViewerToolConfig[];
  activeToolId: string;
  onToolSelect: (toolId: string) => void;
  onReset: () => void;
  className?: string;
}

export function ImageControls({
  tools,
  activeToolId,
  onToolSelect,
  onReset,
  className,
}: ImageControlsProps) {
  return (
    <div
      className={cn(
        'flex gap-1 bg-card/90 backdrop-blur-sm rounded-lg p-1 border border-border',
        className
      )}
    >
      {tools.map((tool) => (
        <Button
          key={tool.id}
          variant="ghost"
          size="icon"
          className={cn(
            'h-9 w-9',
            activeToolId === tool.id && 'bg-primary text-primary-foreground'
          )}
          onClick={() => onToolSelect(tool.id)}
          title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
        >
          <tool.icon className="h-4 w-4" />
        </Button>
      ))}
      <div className="w-px bg-border mx-1" />
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={onReset}
        title="Reset (R)"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}
