import { FindingsPanel } from './FindingsPanel';
import { ImpressionPanel } from './ImpressionPanel';
import { QAChecklist } from './QAChecklist';
import type { Report, QACheck } from '@/types/radiology';

interface RightPanelProps {
  report: Report;
  findings: string;
  impression: string;
  qaChecks: QACheck[];
  isGeneratingImpression: boolean;
  onFindingsChange: (text: string) => void;
  onImpressionChange: (text: string) => void;
  onGenerateImpression: () => Promise<void>;
  onApprove: () => void;
  onSaveFindings?: () => void;
}

export function RightPanel({
  report,
  findings,
  impression,
  qaChecks,
  isGeneratingImpression,
  onFindingsChange,
  onImpressionChange,
  onGenerateImpression,
  onApprove,
  onSaveFindings,
}: RightPanelProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FindingsPanel
        findings={findings}
        onFindingsChange={onFindingsChange}
        onSave={onSaveFindings}
      />
      
      <ImpressionPanel
        impression={impression}
        findings={findings}
        qaStatus={report.qaStatus}
        qaWarnings={report.qaWarnings}
        onImpressionChange={onImpressionChange}
        onGenerateImpression={onGenerateImpression}
        onApprove={onApprove}
        isGenerating={isGeneratingImpression}
      />

      <QAChecklist 
        checks={qaChecks} 
        isLoading={report.qaStatus === 'checking'} 
      />
    </div>
  );
}
