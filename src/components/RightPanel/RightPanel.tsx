import { useCallback } from 'react';
import { FindingsPanel } from './FindingsPanel';
import { ImpressionPanel } from './ImpressionPanel';
import { QAChecklist } from './QAChecklist';
import { TemplatesPanel } from './TemplatesPanel';
import { GuidelinesPanel } from './GuidelinesPanel';
import type { ImageRef, Report, QACheck, ReportTemplate } from '@/types/radiology';

interface RightPanelProps {
  report: Report;
  findings: string;
  impression: string;
  qaChecks: QACheck[];
  isGeneratingImpression: boolean;
  onFindingsChange: (text: string) => void;
  onImpressionChange: (text: string) => void;
  onGenerateImpression: () => Promise<void>;
  onApprove: (signature?: string) => void;
  onSaveFindings?: () => void;
  onAsrStatusChange?: (status: 'idle' | 'listening' | 'processing', confidence: number) => void;
  onExportSr?: (format: 'json' | 'dicom') => void;
  onEvidenceSelect?: (ref: ImageRef) => void;
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
  onAsrStatusChange,
  onExportSr,
  onEvidenceSelect,
}: RightPanelProps) {
  const handleApplyTemplate = useCallback(
    (template: ReportTemplate) => {
      const templateText = template.sections.map((section) => `${section}:\n`).join('\n');
      const merged = findings ? `${findings}\n\n${templateText}` : templateText;
      onFindingsChange(merged);
    },
    [findings, onFindingsChange]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FindingsPanel
        reportId={report.id}
        findings={findings}
        onFindingsChange={onFindingsChange}
        onSave={onSaveFindings}
        onAsrStatusChange={onAsrStatusChange}
      />

      <div className="flex-1 overflow-y-auto">
        <ImpressionPanel
          impression={impression}
          findings={findings}
          qaStatus={report.qaStatus}
          qaWarnings={report.qaWarnings}
          inferenceStatus={report.inferenceStatus}
          inferenceSummary={report.inferenceSummary}
          inferenceConfidence={report.inferenceConfidence}
          inferenceModelVersion={report.inferenceModelVersion}
          inferenceJobId={report.inferenceJobId}
          inferenceCompletedAt={report.inferenceCompletedAt}
          inferenceImageRefs={report.inferenceImageRefs}
          onEvidenceSelect={onEvidenceSelect}
          onImpressionChange={onImpressionChange}
          onGenerateImpression={onGenerateImpression}
          onApprove={onApprove}
          onExportSr={onExportSr}
          isGenerating={isGeneratingImpression}
        />

        <QAChecklist 
          checks={qaChecks} 
          isLoading={report.qaStatus === 'checking'} 
        />

        <TemplatesPanel onApplyTemplate={handleApplyTemplate} />

        <GuidelinesPanel />
      </div>
    </div>
  );
}
