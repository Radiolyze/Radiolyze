import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowRight, ArrowUp, CheckCircle2, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ComparisonStatus =
  | 'new'
  | 'progressed'
  | 'stable'
  | 'regressed'
  | 'resolved';

export type ComparisonTrend = 'improved' | 'worsened' | 'mixed' | 'stable';

export interface ComparisonChange {
  finding: string;
  status: ComparisonStatus;
  evidenceIndicesCurrent?: number[];
  evidenceIndicesPrior?: number[];
  quantitativeChange?: string;
}

export interface ComparisonResult {
  summaryChange: string;
  changes: ComparisonChange[];
  overallTrend: ComparisonTrend;
  confidence?: string | null;
}

interface ComparisonPanelProps {
  result?: ComparisonResult | null;
  isRunning?: boolean;
  error?: string | null;
  onRun?: () => void;
  onEvidenceSelect?: (slice: { role: 'current' | 'prior'; index: number }) => void;
  priorAvailable?: boolean;
}

const STATUS_VARIANT: Record<ComparisonStatus, string> = {
  new: 'bg-amber-100 text-amber-900 border-amber-300',
  progressed: 'bg-red-100 text-red-900 border-red-300',
  stable: 'bg-slate-100 text-slate-800 border-slate-300',
  regressed: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  resolved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

const TREND_ICON: Record<ComparisonTrend, JSX.Element> = {
  improved: <ArrowDown className="h-4 w-4" />,
  worsened: <ArrowUp className="h-4 w-4" />,
  mixed: <ArrowRight className="h-4 w-4" />,
  stable: <CheckCircle2 className="h-4 w-4" />,
};

export function ComparisonPanel({
  result,
  isRunning,
  error,
  onRun,
  onEvidenceSelect,
  priorAvailable = true,
}: ComparisonPanelProps) {
  const { t } = useTranslation();

  const sortedChanges = useMemo(() => {
    if (!result?.changes) return [];
    const order: ComparisonStatus[] = [
      'progressed',
      'new',
      'regressed',
      'stable',
      'resolved',
    ];
    return [...result.changes].sort(
      (a, b) => order.indexOf(a.status) - order.indexOf(b.status),
    );
  }, [result?.changes]);

  return (
    <section
      aria-label={t('comparison.title', 'Vergleich mit Voruntersuchung')}
      className="flex flex-col gap-3 rounded-lg border bg-background p-4"
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          {t('comparison.title', 'Vergleich mit Voruntersuchung')}
        </h3>
        {onRun && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRun}
            disabled={isRunning || !priorAvailable}
          >
            {isRunning
              ? t('comparison.running', 'Läuft …')
              : t('comparison.run', 'Vergleichen')}
          </Button>
        )}
      </header>

      {!priorAvailable && (
        <p className="text-xs text-muted-foreground">
          {t('comparison.noPrior', 'Keine Voruntersuchung verfügbar.')}
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {result && (
        <>
          <div className="flex items-start gap-2 text-sm">
            <span
              className={cn(
                'mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border',
                result.overallTrend === 'worsened' && 'bg-red-50 text-red-900 border-red-300',
                result.overallTrend === 'improved' && 'bg-emerald-50 text-emerald-900 border-emerald-300',
                result.overallTrend === 'mixed' && 'bg-amber-50 text-amber-900 border-amber-300',
                result.overallTrend === 'stable' && 'bg-slate-50 text-slate-800 border-slate-300',
              )}
              aria-label={t('comparison.trend.' + result.overallTrend, result.overallTrend)}
            >
              {TREND_ICON[result.overallTrend]}
            </span>
            <p className="text-foreground">{result.summaryChange}</p>
          </div>

          {sortedChanges.length > 0 && (
            <ul className="flex flex-col gap-2" role="list">
              {sortedChanges.map((change, index) => (
                <li
                  key={`${change.finding}-${index}`}
                  className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{change.finding}</span>
                    <Badge
                      variant="outline"
                      className={cn('text-xs uppercase', STATUS_VARIANT[change.status])}
                    >
                      {t('comparison.status.' + change.status, change.status)}
                    </Badge>
                  </div>
                  {change.quantitativeChange && (
                    <span className="text-xs text-muted-foreground">
                      {change.quantitativeChange}
                    </span>
                  )}
                  <div className="flex flex-wrap gap-1 text-xs">
                    {(change.evidenceIndicesCurrent ?? []).map((idx) => (
                      <button
                        key={`cur-${idx}`}
                        type="button"
                        className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-primary hover:bg-primary/20"
                        onClick={() => onEvidenceSelect?.({ role: 'current', index: idx })}
                      >
                        {t('comparison.evidence.current', 'C{{idx}}', { idx })}
                      </button>
                    ))}
                    {(change.evidenceIndicesPrior ?? []).map((idx) => (
                      <button
                        key={`prior-${idx}`}
                        type="button"
                        className="rounded border border-muted-foreground/40 bg-muted px-2 py-0.5 hover:bg-muted-foreground/10"
                        onClick={() => onEvidenceSelect?.({ role: 'prior', index: idx })}
                      >
                        {t('comparison.evidence.prior', 'P{{idx}}', { idx })}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {result.confidence && (
            <p className="text-xs text-muted-foreground">
              {t('comparison.confidence', 'Konfidenz')}: {result.confidence}
            </p>
          )}
        </>
      )}
    </section>
  );
}
