import { useTranslation } from 'react-i18next';
import { Columns2, X, ArrowLeftRight, Link2, Link2Off, ZoomIn, Move, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { SyncOptions } from '@/types/viewerSync';
import type { PriorStudy } from './comparisonTypes';

interface ComparisonToolbarProps {
  priorStudies: PriorStudy[];
  selectedPriorStudyId: string | null;
  selectedPriorSeriesId: string | null;
  selectedPriorStudy?: PriorStudy;
  syncOptions: SyncOptions;
  hasSyncEnabled: boolean;
  isSwapped: boolean;
  onSelectPriorStudy: (studyId: string) => void;
  onSelectPriorSeries: (seriesId: string) => void;
  onToggleSyncOption: (option: keyof SyncOptions) => void;
  onSwap: () => void;
  onDisable: () => void;
}

export function ComparisonToolbar({
  priorStudies,
  selectedPriorStudyId,
  selectedPriorSeriesId,
  selectedPriorStudy,
  syncOptions,
  hasSyncEnabled,
  isSwapped,
  onSelectPriorStudy,
  onSelectPriorSeries,
  onToggleSyncOption,
  onSwap,
  onDisable,
}: ComparisonToolbarProps) {
  const { t } = useTranslation('viewer');

  return (
    <div className="h-12 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="text-primary border-primary">
          <Columns2 className="h-3 w-3 mr-1" />
          {t('comparison.title')}
        </Badge>

        {/* Prior Study Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('comparison.prior')}:</span>
          <Select value={selectedPriorStudyId || ''} onValueChange={onSelectPriorStudy}>
            <SelectTrigger className="h-8 w-[200px]">
              <SelectValue placeholder={t('comparison.selectStudy')} />
            </SelectTrigger>
            <SelectContent>
              {priorStudies.map((prior) => (
                <SelectItem key={prior.study.id} value={prior.study.id}>
                  {prior.label} ({prior.date})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Prior Series Selector */}
          {selectedPriorStudy && (
            <Select value={selectedPriorSeriesId || ''} onValueChange={onSelectPriorSeries}>
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue placeholder={t('comparison.selectSeries')} />
              </SelectTrigger>
              <SelectContent>
                {selectedPriorStudy.study.series.map((series) => (
                  <SelectItem key={series.id} value={series.id}>
                    {series.seriesDescription}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Sync Options Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={hasSyncEnabled || syncOptions.frames ? 'default' : 'outline'}
              size="sm"
              className="gap-1"
            >
              {hasSyncEnabled || syncOptions.frames ? (
                <Link2 className="h-4 w-4" />
              ) : (
                <Link2Off className="h-4 w-4" />
              )}
              Sync
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{t('sync.title')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={syncOptions.frames}
              onCheckedChange={() => onToggleSyncOption('frames')}
            >
              {t('sync.frames')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={syncOptions.zoom}
              onCheckedChange={() => onToggleSyncOption('zoom')}
            >
              <ZoomIn className="h-3.5 w-3.5 mr-2" />
              {t('sync.zoom')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={syncOptions.pan}
              onCheckedChange={() => onToggleSyncOption('pan')}
            >
              <Move className="h-3.5 w-3.5 mr-2" />
              {t('sync.pan')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={syncOptions.windowLevel}
              onCheckedChange={() => onToggleSyncOption('windowLevel')}
            >
              <Sun className="h-3.5 w-3.5 mr-2" />
              {t('sync.windowLevel')}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Swap Views */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isSwapped ? 'default' : 'outline'}
              size="icon"
              className="h-8 w-8"
              onClick={onSwap}
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t('comparison.swap')}
          </TooltipContent>
        </Tooltip>

        {/* Exit Compare Mode */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onDisable}
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('comparison.disable')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
