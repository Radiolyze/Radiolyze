import { 
  RotateCcw, 
  Box, 
  Eye, 
  Sun,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Scan,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { VRT_PRESETS, type VRTSettings, type VRTViewAngle } from '@/types/vrt';
import { cn } from '@/lib/utils';

interface VRTToolbarProps {
  settings: VRTSettings;
  onSettingsChange: (settings: VRTSettings) => void;
  onPresetChange: (presetId: string) => void;
  onViewAngle: (angle: VRTViewAngle) => void;
  onReset: () => void;
  className?: string;
}

export function VRTToolbar({
  settings,
  onSettingsChange,
  onPresetChange,
  onViewAngle,
  onReset,
  className,
}: VRTToolbarProps) {
  const currentPreset = VRT_PRESETS.find(p => p.id === settings.presetId);

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 bg-card border-b border-border',
        className
      )}>
        {/* 3D Indicator */}
        <div className="flex items-center gap-1.5 text-primary">
          <Box className="h-4 w-4" />
          <span className="text-sm font-medium">3D VRT</span>
        </div>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Preset Selection */}
        <Select value={settings.presetId} onValueChange={onPresetChange}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Preset wählen" />
          </SelectTrigger>
          <SelectContent>
            {VRT_PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                <div className="flex flex-col">
                  <span>{preset.name}</span>
                  <span className="text-xs text-muted-foreground">{preset.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="h-6 w-px bg-border mx-1" />

        {/* View Angle Buttons */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onViewAngle('anterior')}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Anterior (A)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onViewAngle('posterior')}
              >
                <Scan className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Posterior (P)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onViewAngle('left')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Left (L)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onViewAngle('right')}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Right (R)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onViewAngle('superior')}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Superior (S)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onViewAngle('inferior')}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Inferior (I)</TooltipContent>
          </Tooltip>
        </div>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Lighting/Quality Settings */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5">
              <Sun className="h-4 w-4" />
              <span className="text-xs">Beleuchtung</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div className="font-medium text-sm">Rendering-Einstellungen</div>
              
              {/* Sample Distance (Quality) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Renderqualität</span>
                  <span className="text-muted-foreground">
                    {settings.sampleDistance < 0.5 ? 'Hoch' : settings.sampleDistance < 1.5 ? 'Mittel' : 'Schnell'}
                  </span>
                </div>
                <Slider
                  value={[settings.sampleDistance]}
                  onValueChange={([v]) => onSettingsChange({ ...settings, sampleDistance: v })}
                  min={0.2}
                  max={3}
                  step={0.1}
                  className="w-full"
                />
              </div>

              {/* Ambient */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Umgebungslicht</span>
                  <span className="text-muted-foreground">{Math.round(settings.ambient * 100)}%</span>
                </div>
                <Slider
                  value={[settings.ambient]}
                  onValueChange={([v]) => onSettingsChange({ ...settings, ambient: v })}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </div>

              {/* Diffuse */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Diffuse Reflexion</span>
                  <span className="text-muted-foreground">{Math.round(settings.diffuse * 100)}%</span>
                </div>
                <Slider
                  value={[settings.diffuse]}
                  onValueChange={([v]) => onSettingsChange({ ...settings, diffuse: v })}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </div>

              {/* Specular */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Spiegelreflexion</span>
                  <span className="text-muted-foreground">{Math.round(settings.specular * 100)}%</span>
                </div>
                <Slider
                  value={[settings.specular]}
                  onValueChange={([v]) => onSettingsChange({ ...settings, specular: v })}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </div>

              {/* Specular Power */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Glanzstärke</span>
                  <span className="text-muted-foreground">{settings.specularPower}</span>
                </div>
                <Slider
                  value={[settings.specularPower]}
                  onValueChange={([v]) => onSettingsChange({ ...settings, specularPower: v })}
                  min={1}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {/* Reset */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={onReset}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Kamera zurücksetzen</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
