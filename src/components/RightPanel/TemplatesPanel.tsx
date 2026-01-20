import { useState } from 'react';
import { FileText, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { mockTemplates } from '@/data/mockData';
import type { ReportTemplate } from '@/types/radiology';

interface TemplatesPanelProps {
  templates?: ReportTemplate[];
  onApplyTemplate?: (template: ReportTemplate) => void;
  isOpenByDefault?: boolean;
}

export function TemplatesPanel({
  templates = mockTemplates,
  onApplyTemplate,
  isOpenByDefault = false,
}: TemplatesPanelProps) {
  const [isOpen, setIsOpen] = useState(isOpenByDefault);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="px-4 py-3 border-t border-border flex items-center justify-between hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            <span>Templates</span>
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
              {templates.length}
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
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-lg border border-border bg-panel-secondary/40 p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{template.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {template.modality}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {template.sections.map((section) => (
                  <Badge key={section} variant="secondary" className="text-[10px]">
                    {section}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Aktualisiert: {template.lastUpdated}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onApplyTemplate?.(template)}
                >
                  Anwenden
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
