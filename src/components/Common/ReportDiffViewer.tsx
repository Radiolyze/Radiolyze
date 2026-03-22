import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GitCompare, Plus, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Revision {
  id: string;
  findings_text: string;
  impression_text: string;
  changed_by?: string;
  changed_at: string;
}

interface ReportDiffViewerProps {
  revisionA: Revision;
  revisionB: Revision;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

function computeLineDiff(textA: string, textB: string): DiffLine[] {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const m = linesA.length;
  const n = linesB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  let i = m;
  let j = n;
  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      stack.push({ type: 'unchanged', text: linesA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'added', text: linesB[j - 1] });
      j--;
    } else {
      stack.push({ type: 'removed', text: linesA[i - 1] });
      i--;
    }
  }

  stack.reverse();
  return stack;
}

function DiffBlock({ label, diff }: { label: string; diff: DiffLine[] }) {
  const added = diff.filter((d) => d.type === 'added').length;
  const removed = diff.filter((d) => d.type === 'removed').length;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {added > 0 && (
          <Badge variant="outline" className="text-green-400 border-green-700 text-xs px-1">
            <Plus className="h-3 w-3 mr-0.5" />{added}
          </Badge>
        )}
        {removed > 0 && (
          <Badge variant="outline" className="text-red-400 border-red-700 text-xs px-1">
            <Minus className="h-3 w-3 mr-0.5" />{removed}
          </Badge>
        )}
      </div>
      <div className="font-mono text-xs space-y-0 rounded border border-border/50 overflow-hidden">
        {diff.map((line, idx) => (
          <div
            key={idx}
            className={
              line.type === 'added'
                ? 'bg-green-950/40 text-green-300 px-2 py-0.5'
                : line.type === 'removed'
                  ? 'bg-red-950/40 text-red-300 px-2 py-0.5 line-through'
                  : 'text-muted-foreground px-2 py-0.5'
            }
          >
            <span className="inline-block w-4 text-muted-foreground/50 select-none">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            {line.text || '\u00A0'}
          </div>
        ))}
        {diff.length === 0 && (
          <div className="text-muted-foreground/50 px-2 py-1 italic">Keine Änderungen</div>
        )}
      </div>
    </div>
  );
}

export function ReportDiffViewer({ revisionA, revisionB }: ReportDiffViewerProps) {
  const { t } = useTranslation('report');

  const findingsDiff = useMemo(
    () => computeLineDiff(revisionA.findings_text, revisionB.findings_text),
    [revisionA.findings_text, revisionB.findings_text]
  );

  const impressionDiff = useMemo(
    () => computeLineDiff(revisionA.impression_text, revisionB.impression_text),
    [revisionA.impression_text, revisionB.impression_text]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <GitCompare className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          {new Date(revisionA.changed_at).toLocaleString()}
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="text-muted-foreground">
          {new Date(revisionB.changed_at).toLocaleString()}
        </span>
      </div>
      <ScrollArea className="max-h-[500px]">
        <div className="space-y-4 pr-2">
          <DiffBlock
            label={t('findings.title', 'Befund')}
            diff={findingsDiff}
          />
          <DiffBlock
            label={t('impression.title', 'Beurteilung')}
            diff={impressionDiff}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
