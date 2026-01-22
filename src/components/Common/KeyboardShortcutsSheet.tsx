import { useTranslation } from 'react-i18next';
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

export function KeyboardShortcutsSheet({ open, onOpenChange }: KeyboardShortcutsSheetProps) {
  const { t } = useTranslation('common');

  const shortcutGroups = [
    {
      titleKey: 'shortcuts.groups.general',
      shortcuts: [
        { keys: ['Ctrl', 'S'], descriptionKey: 'shortcuts.actions.saveReport', icon: Save },
        { keys: ['Ctrl', 'Enter'], descriptionKey: 'shortcuts.actions.approveReport', icon: CheckCircle },
      ],
    },
    {
      titleKey: 'shortcuts.groups.dictation',
      shortcuts: [
        { keys: ['Ctrl', 'M'], descriptionKey: 'shortcuts.actions.toggleMic', icon: Mic },
      ],
    },
    {
      titleKey: 'shortcuts.groups.viewer',
      shortcuts: [
        { keys: ['Z'], descriptionKey: 'shortcuts.actions.zoomMode', icon: ZoomIn },
        { keys: ['P'], descriptionKey: 'shortcuts.actions.panMode', icon: Move },
        { keys: ['M'], descriptionKey: 'shortcuts.actions.measure', icon: Ruler },
        { keys: ['R'], descriptionKey: 'shortcuts.actions.resetView', icon: RotateCcw },
      ],
    },
    {
      titleKey: 'shortcuts.groups.navigation',
      shortcuts: [
        { keys: ['↑', 'W'], descriptionKey: 'shortcuts.actions.prevFrame', icon: ArrowUp },
        { keys: ['↓', 'S'], descriptionKey: 'shortcuts.actions.nextFrame', icon: ArrowDown },
        { keys: ['Scroll'], descriptionKey: 'shortcuts.actions.scrollFrames' },
      ],
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:max-w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            {t('shortcuts.title')}
          </SheetTitle>
          <SheetDescription>
            {t('shortcuts.description')}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.titleKey} className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t(group.titleKey)}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.descriptionKey}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-panel-secondary/50 hover:bg-panel-secondary transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      {shortcut.icon && (
                        <shortcut.icon className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{t(shortcut.descriptionKey)}</span>
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
            {t('shortcuts.helpHint').split('?')[0]}<Badge variant="outline" className="font-mono text-[10px] px-1.5 mx-1">?</Badge>{t('shortcuts.helpHint').split('?')[1]}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
