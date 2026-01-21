import { CheckCircle, AlertTriangle, XCircle, ChevronDown, EyeOff } from 'lucide-react';
import type { QACheck } from '@/types/radiology';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import { useUserPreferences } from '@/hooks/useUserPreferences';

interface QAChecklistProps {
  checks: QACheck[];
  isLoading?: boolean;
}

const statusIcons = {
  pass: CheckCircle,
  warn: AlertTriangle,
  fail: XCircle,
};

const statusColors = {
  pass: 'text-success',
  warn: 'text-warning',
  fail: 'text-destructive',
};

export function QAChecklist({ checks, isLoading = false }: QAChecklistProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { preferences } = useUserPreferences();

  const passCount = checks.filter(c => c.status === 'pass').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const failCount = checks.filter(c => c.status === 'fail').length;

  // If QA warnings are disabled and all checks pass, hide the component
  if (!preferences.showQAWarnings && warnCount === 0 && failCount === 0) {
    return null;
  }

  // Show compact view when warnings are disabled but there are issues
  if (!preferences.showQAWarnings && (warnCount > 0 || failCount > 0)) {
    return (
      <div className="px-4 py-3 border-t border-border flex items-center gap-2 text-sm">
        <EyeOff className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">QA-Warnungen ausgeblendet</span>
        {(warnCount > 0 || failCount > 0) && (
          <div className="flex items-center gap-1.5 text-xs ml-auto">
            {warnCount > 0 && (
              <span className="flex items-center gap-0.5 text-warning">
                <AlertTriangle className="h-3 w-3" />
                {warnCount}
              </span>
            )}
            {failCount > 0 && (
              <span className="flex items-center gap-0.5 text-destructive">
                <XCircle className="h-3 w-3" />
                {failCount}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="px-4 py-3 border-t border-border flex items-center justify-between hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span>QA Prüfungen</span>
            {!isLoading && (
              <div className="flex items-center gap-1.5 text-xs">
                {passCount > 0 && (
                  <span className="flex items-center gap-0.5 text-success">
                    <CheckCircle className="h-3 w-3" />
                    {passCount}
                  </span>
                )}
                {warnCount > 0 && (
                  <span className="flex items-center gap-0.5 text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    {warnCount}
                  </span>
                )}
                {failCount > 0 && (
                  <span className="flex items-center gap-0.5 text-destructive">
                    <XCircle className="h-3 w-3" />
                    {failCount}
                  </span>
                )}
              </div>
            )}
          </div>
          <ChevronDown className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-4 pb-3 space-y-1">
          {isLoading ? (
            <div className="py-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full spinner" />
              Prüfungen werden durchgeführt...
            </div>
          ) : (
            checks.map((check) => {
              const Icon = statusIcons[check.status];
              return (
                <div
                  key={check.id}
                  className="flex items-start gap-2 py-1.5 text-sm"
                >
                  <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', statusColors[check.status])} />
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground">{check.name}</span>
                    {check.message && (
                      <p className="text-xs text-muted-foreground mt-0.5">{check.message}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
