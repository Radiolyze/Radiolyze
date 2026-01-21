import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Keyboard, Mic, Save, CheckCircle, ZoomIn, Move, Ruler, RotateCcw, ArrowUp, ArrowDown } from 'lucide-react';

interface KeyboardShortcutsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcutGroups = [
  {
    title: 'Allgemein',
    shortcuts: [
      { keys: ['Ctrl', 'S'], description: 'Befund speichern', icon: Save },
      { keys: ['Ctrl', 'Enter'], description: 'Report freigeben', icon: CheckCircle },
    ],
  },
  {
    title: 'Diktat (ASR)',
    shortcuts: [
      { keys: ['Ctrl', 'M'], description: 'Mikrofon ein/aus', icon: Mic },
    ],
  },
  {
    title: 'DICOM Viewer',
    shortcuts: [
      { keys: ['Z'], description: 'Zoom-Modus', icon: ZoomIn },
      { keys: ['P'], description: 'Pan-Modus', icon: Move },
      { keys: ['M'], description: 'Messen', icon: Ruler },
      { keys: ['R'], description: 'Ansicht zurücksetzen', icon: RotateCcw },
    ],
  },
  {
    title: 'Frame-Navigation',
    shortcuts: [
      { keys: ['↑', 'W'], description: 'Vorheriger Frame', icon: ArrowUp },
      { keys: ['↓', 'S'], description: 'Nächster Frame', icon: ArrowDown },
      { keys: ['Scroll'], description: 'Frames durchblättern' },
    ],
  },
];

export function KeyboardShortcutsSheet({ open, onOpenChange }: KeyboardShortcutsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:max-w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Tastenkürzel
          </SheetTitle>
          <SheetDescription>
            Schneller arbeiten mit Keyboard Shortcuts
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-panel-secondary/50 hover:bg-panel-secondary transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      {shortcut.icon && (
                        <shortcut.icon className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{shortcut.description}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i}>
                          <Badge
                            variant="outline"
                            className="font-mono text-xs px-2 py-0.5 bg-background"
                          >
                            {key}
                          </Badge>
                          {i < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground mx-0.5">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Drücke <Badge variant="outline" className="font-mono text-[10px] px-1.5 mx-1">?</Badge> um diese Hilfe zu öffnen
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
