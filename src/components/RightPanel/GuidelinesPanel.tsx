import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, ChevronDown, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { mockGuidelines } from '@/data/mockData';
import type { Guideline } from '@/types/radiology';

interface GuidelinesPanelProps {
  guidelines?: Guideline[];
  isOpenByDefault?: boolean;
}

const statusStyles: Record<Guideline['status'], { icon: typeof Info; className: string; labelKey: string }> = {
  pass: { icon: CheckCircle, className: 'text-success', labelKey: 'guidelines.status.pass' },
  warn: { icon: AlertTriangle, className: 'text-warning', labelKey: 'guidelines.status.warn' },
  info: { icon: Info, className: 'text-info', labelKey: 'guidelines.status.info' },
  critical: { icon: XCircle, className: 'text-destructive', labelKey: 'guidelines.status.critical' },
};

export function GuidelinesPanel({
  guidelines = mockGuidelines,
  isOpenByDefault = false,
}: GuidelinesPanelProps) {
  const { t } = useTranslation('report');
  const [isOpen, setIsOpen] = useState(isOpenByDefault);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="px-4 py-3 border-t border-border flex items-center justify-between hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className="h-4 w-4" />
            <span>{t('guidelines.title')}</span>
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
              {guidelines.length}
            </Badge>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-3">
          {guidelines.map((guideline) => {
            const config = statusStyles[guideline.status];
            const Icon = config.icon;

            return (
              <div
                key={guideline.id}
                className="rounded-lg border border-border bg-panel-secondary/40 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{guideline.title}</p>
                    <p className="text-xs text-muted-foreground">{guideline.category}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-2">
                    <Icon className={cn('h-3 w-3 mr-1', config.className)} />
                    {t(config.labelKey)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{guideline.summary}</p>
                {guideline.source && (
                  <div className="text-[10px] text-muted-foreground">
                    {t('guidelines.source')}: {guideline.source}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
