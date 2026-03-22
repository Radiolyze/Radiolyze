import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GitCompare } from 'lucide-react';
import type { ReportResponsePayload } from '@/services/reportClient';
import { usePriorReports } from '@/hooks/usePriorReports';

interface ReportDiffPanelProps {
  patientId: string | undefined;
  currentReportId: string | undefined;
  currentFindings: string;
  currentImpression: string;
}

/**
 * Compute a simple word-level diff between two texts.
 * Returns an array of { text, type } segments.
 */
function computeWordDiff(
  oldText: string,
  newText: string,
): Array<{ text: string; type: 'same' | 'added' | 'removed' }> {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  const result: Array<{ text: string; type: 'same' | 'added' | 'removed' }> = [];

  // Simple LCS-based diff for reasonable-length texts
  const m = oldWords.length;
  const n = newWords.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  let i = m;
  let j = n;
  const segments: Array<{ text: string; type: 'same' | 'added' | 'removed' }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      segments.unshift({ text: oldWords[i - 1], type: 'same' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      segments.unshift({ text: newWords[j - 1], type: 'added' });
      j--;
    } else {
      segments.unshift({ text: oldWords[i - 1], type: 'removed' });
      i--;
    }
  }

  // Merge consecutive same-type segments
  for (const seg of segments) {
    if (result.length > 0 && result[result.length - 1].type === seg.type) {
      result[result.length - 1].text += seg.text;
    } else {
      result.push({ ...seg });
    }
  }

  return result;
}

function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const segments = useMemo(() => computeWordDiff(oldText, newText), [oldText, newText]);

  if (!oldText && !newText) {
    return <span className="text-muted-foreground text-sm italic">Kein Text vorhanden</span>;
  }

  return (
    <div className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
      {segments.map((seg, idx) => {
        if (seg.type === 'removed') {
          return (
            <span key={idx} className="bg-red-500/20 text-red-400 line-through">
              {seg.text}
            </span>
          );
        }
        if (seg.type === 'added') {
          return (
            <span key={idx} className="bg-green-500/20 text-green-400">
              {seg.text}
            </span>
          );
        }
        return <span key={idx}>{seg.text}</span>;
      })}
    </div>
  );
}

export function ReportDiffPanel({
  patientId,
  currentReportId,
  currentFindings,
  currentImpression,
}: ReportDiffPanelProps) {
  const { t } = useTranslation('report');
  const { priorReports, isLoading } = usePriorReports(patientId, currentReportId);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const selectedReport: ReportResponsePayload | undefined = useMemo(
    () => priorReports.find((r) => r.id === selectedReportId),
    [priorReports, selectedReportId],
  );

  if (!patientId) return null;

  return (
    <details className="border-t border-border">
      <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-accent/50 text-sm font-medium">
        <GitCompare className="w-4 h-4" />
        Vorbefund vergleichen
        {priorReports.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {priorReports.length} Vorbefund{priorReports.length !== 1 ? 'e' : ''}
          </span>
        )}
      </summary>

      <div className="px-4 pb-4 space-y-3">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Lade Vorbefunde…</p>
        )}

        {!isLoading && priorReports.length === 0 && (
          <p className="text-sm text-muted-foreground">Keine Vorbefunde vorhanden.</p>
        )}

        {priorReports.length > 0 && (
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            value={selectedReportId ?? ''}
            onChange={(e) => setSelectedReportId(e.target.value || null)}
          >
            <option value="">Vorbefund auswählen…</option>
            {priorReports.map((r) => (
              <option key={r.id} value={r.id}>
                {new Date(r.created_at).toLocaleDateString('de-DE')} – {r.status}
              </option>
            ))}
          </select>
        )}

        {selectedReport && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                Befund (Diff)
              </h4>
              <DiffView
                oldText={selectedReport.findings_text}
                newText={currentFindings}
              />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                Beurteilung (Diff)
              </h4>
              <DiffView
                oldText={selectedReport.impression_text}
                newText={currentImpression}
              />
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
