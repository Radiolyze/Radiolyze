import { useTranslation } from 'react-i18next';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Keyboard, 
  Mic, 
  Save, 
  CheckCircle, 
  ZoomIn, 
  Move, 
  Ruler, 
  RotateCcw, 
  ArrowUp, 
  ArrowDown,
  Box,
  View,
  Maximize,
  Layers,
  Eye,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  type LucideIcon,
} from 'lucide-react';

interface KeyboardShortcutsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
  keys: string[];
  descriptionKey: string;
  icon?: LucideIcon;
}

interface ShortcutGroup {
  titleKey: string;
  shortcuts: ShortcutItem[];
}

export function KeyboardShortcutsSheet({ open, onOpenChange }: KeyboardShortcutsSheetProps) {
  const { t } = useTranslation('common');

  // General shortcuts (all modes)
  const generalShortcuts: ShortcutGroup[] = [
    {
      titleKey: 'shortcuts.groups.general',
      shortcuts: [
        { keys: ['Ctrl', 'S'], descriptionKey: 'shortcuts.actions.saveReport', icon: Save },
        { keys: ['Ctrl', 'Enter'], descriptionKey: 'shortcuts.actions.approveReport', icon: CheckCircle },
        { keys: ['?'], descriptionKey: 'shortcuts.actions.showHelp', icon: Keyboard },
      ],
    },
    {
      titleKey: 'shortcuts.groups.dictation',
      shortcuts: [
        { keys: ['Ctrl', 'M'], descriptionKey: 'shortcuts.actions.toggleMic', icon: Mic },
      ],
    },
  ];

  // Stack viewer shortcuts
  const stackShortcuts: ShortcutGroup[] = [
    {
      titleKey: 'shortcuts.groups.viewerTools',
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

  // MPR viewer shortcuts
  const mprShortcuts: ShortcutGroup[] = [
    {
      titleKey: 'shortcuts.groups.mprLayout',
      shortcuts: [
        { keys: ['1'], descriptionKey: 'shortcuts.actions.maximizeAxial', icon: Maximize },
        { keys: ['2'], descriptionKey: 'shortcuts.actions.maximizeSagittal', icon: Maximize },
        { keys: ['3'], descriptionKey: 'shortcuts.actions.maximizeCoronal', icon: Maximize },
        { keys: ['Esc'], descriptionKey: 'shortcuts.actions.exitMaximize', icon: RotateCcw },
      ],
    },
    {
      titleKey: 'shortcuts.groups.mprProjection',
      shortcuts: [
        { keys: ['M'], descriptionKey: 'shortcuts.actions.toggleMIP', icon: Layers },
      ],
    },
    {
      titleKey: 'shortcuts.groups.mprMouse',
      shortcuts: [
        { keys: ['LMB'], descriptionKey: 'shortcuts.actions.crosshairs', icon: Crosshair },
        { keys: ['RMB'], descriptionKey: 'shortcuts.actions.panMouse', icon: Move },
        { keys: ['Scroll'], descriptionKey: 'shortcuts.actions.zoomMouse', icon: ZoomIn },
        { keys: ['Shift', 'LMB'], descriptionKey: 'shortcuts.actions.windowLevel' },
      ],
    },
  ];

  // VRT 3D viewer shortcuts
  const vrtShortcuts: ShortcutGroup[] = [
    {
      titleKey: 'shortcuts.groups.vrtPresets',
      shortcuts: [
        { keys: ['1'], descriptionKey: 'shortcuts.actions.presetBone' },
        { keys: ['2'], descriptionKey: 'shortcuts.actions.presetLung' },
        { keys: ['3'], descriptionKey: 'shortcuts.actions.presetSoftTissue' },
        { keys: ['4'], descriptionKey: 'shortcuts.actions.presetAngio' },
        { keys: ['5'], descriptionKey: 'shortcuts.actions.presetMuscleBone' },
      ],
    },
    {
      titleKey: 'shortcuts.groups.vrtViews',
      shortcuts: [
        { keys: ['A'], descriptionKey: 'shortcuts.actions.viewAnterior', icon: Eye },
        { keys: ['P'], descriptionKey: 'shortcuts.actions.viewPosterior', icon: Eye },
        { keys: ['L'], descriptionKey: 'shortcuts.actions.viewLeft', icon: ArrowLeft },
        { keys: ['R'], descriptionKey: 'shortcuts.actions.viewRight', icon: ArrowRight },
        { keys: ['S'], descriptionKey: 'shortcuts.actions.viewSuperior', icon: ArrowUp },
        { keys: ['I'], descriptionKey: 'shortcuts.actions.viewInferior', icon: ArrowDown },
      ],
    },
    {
      titleKey: 'shortcuts.groups.vrtMouse',
      shortcuts: [
        { keys: ['LMB'], descriptionKey: 'shortcuts.actions.rotate3D', icon: RotateCcw },
        { keys: ['RMB'], descriptionKey: 'shortcuts.actions.panMouse', icon: Move },
        { keys: ['Scroll'], descriptionKey: 'shortcuts.actions.zoomMouse', icon: ZoomIn },
        { keys: ['Esc'], descriptionKey: 'shortcuts.actions.resetCamera', icon: RotateCcw },
      ],
    },
  ];

  const renderShortcutGroup = (group: ShortcutGroup) => (
    <div key={group.titleKey} className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {t(group.titleKey)}
      </h3>
      <div className="space-y-1">
        {group.shortcuts.map((shortcut) => (
          <div
            key={shortcut.descriptionKey}
            className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm">
              {shortcut.icon && (
                <shortcut.icon className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="text-foreground/90">{t(shortcut.descriptionKey)}</span>
            </div>
            <div className="flex items-center gap-0.5">
              {shortcut.keys.map((key, i) => (
                <span key={i} className="flex items-center">
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] px-1.5 py-0 h-5 bg-background border-border"
                  >
                    {key}
                  </Badge>
                  {i < shortcut.keys.length - 1 && (
                    <span className="text-muted-foreground text-xs mx-0.5">+</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            {t('shortcuts.title')}
          </SheetTitle>
          <SheetDescription>
            {t('shortcuts.description')}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4 grid grid-cols-4 h-9">
            <TabsTrigger value="general" className="text-xs">
              {t('shortcuts.tabs.general')}
            </TabsTrigger>
            <TabsTrigger value="stack" className="text-xs">
              Stack
            </TabsTrigger>
            <TabsTrigger value="mpr" className="text-xs flex items-center gap-1">
              <Box className="h-3 w-3" />
              MPR
            </TabsTrigger>
            <TabsTrigger value="vrt" className="text-xs flex items-center gap-1">
              <View className="h-3 w-3" />
              3D
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6 py-4">
            <TabsContent value="general" className="mt-0 space-y-4">
              {generalShortcuts.map(renderShortcutGroup)}
            </TabsContent>

            <TabsContent value="stack" className="mt-0 space-y-4">
              {stackShortcuts.map(renderShortcutGroup)}
            </TabsContent>

            <TabsContent value="mpr" className="mt-0 space-y-4">
              <div className="p-2 rounded-md bg-primary/10 border border-primary/20 mb-4">
                <p className="text-xs text-primary">
                  {t('shortcuts.hints.mprAvailable')}
                </p>
              </div>
              {mprShortcuts.map(renderShortcutGroup)}
            </TabsContent>

            <TabsContent value="vrt" className="mt-0 space-y-4">
              <div className="p-2 rounded-md bg-primary/10 border border-primary/20 mb-4">
                <p className="text-xs text-primary">
                  {t('shortcuts.hints.vrtAvailable')}
                </p>
              </div>
              {vrtShortcuts.map(renderShortcutGroup)}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            {t('shortcuts.helpHint').replace('?', '')}
            <Badge variant="outline" className="font-mono text-[10px] px-1.5 mx-1 bg-background">?</Badge>
            {t('shortcuts.helpHintSuffix')}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
