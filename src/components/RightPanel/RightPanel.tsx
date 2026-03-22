import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FindingsPanel } from './FindingsPanel';
import { ImpressionPanel } from './ImpressionPanel';
import { QAChecklist } from './QAChecklist';
import { TemplatesPanel } from './TemplatesPanel';
import { GuidelinesPanel } from './GuidelinesPanel';
import { ReportDiffPanel } from './ReportDiffPanel';
import type { AutoSaveStatus } from '@/hooks/useAutoSave';
import type { ImageRef, Report, QACheck, ReportTemplate } from '@/types/radiology';

interface RightPanelProps {
  report: Report;
  findings: string;
  impression: string;
  qaChecks: QACheck[];
  isGeneratingImpression: boolean;
  isAnalyzingImages?: boolean;
  autoSaveStatus?: AutoSaveStatus;
  onFindingsChange: (text: string) => void;
  onImpressionChange: (text: string) => void;
  onGenerateImpression: () => Promise<void>;
  onAnalyzeImages?: () => Promise<void>;
  onApprove: (signature?: string) => void;
  onSaveFindings?: () => void;
  onAsrStatusChange?: (status: 'idle' | 'listening' | 'processing', confidence: number) => void;
  onExportSr?: (format: 'json' | 'dicom') => void;
  onEvidenceSelect?: (ref: ImageRef) => void;
  useAllFrames?: boolean;
  onUseAllFramesChange?: (nextValue: boolean) => void;
}

const AUTO_SAVE_LABELS: Record<AutoSaveStatus, string> = {
  idle: '',
  saving: 'Speichern…',
  saved: 'Gespeichert',
  conflict: 'Konflikt',
  error: 'Fehler',
};

const AUTO_SAVE_COLORS: Record<AutoSaveStatus, string> = {
  idle: '',
  saving: 'text-muted-foreground',
  saved: 'text-green-500',
  conflict: 'text-yellow-500',
  error: 'text-destructive',
};

export function RightPanel({
  report,
  findings,
  impression,
  qaChecks,
  isGeneratingImpression,
  isAnalyzingImages,
  autoSaveStatus,
  onFindingsChange,
  onImpressionChange,
  onGenerateImpression,
  onAnalyzeImages,
  onApprove,
  onSaveFindings,
  onAsrStatusChange,
  onExportSr,
  onEvidenceSelect,
  useAllFrames,
  onUseAllFramesChange,
}: RightPanelProps) {
  const { t } = useTranslation('common');
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
      {autoSaveStatus && autoSaveStatus !== 'idle' && (
        <div className={`px-3 py-1 text-xs ${AUTO_SAVE_COLORS[autoSaveStatus]}`}>
          {AUTO_SAVE_LABELS[autoSaveStatus]}
        </div>
      )}
      <FindingsPanel
        reportId={report.id}
        findings={findings}
        onFindingsChange={onFindingsChange}
        onSave={onSaveFindings}
        onAsrStatusChange={onAsrStatusChange}
        onAnalyzeImages={onAnalyzeImages}
        isAnalyzing={isAnalyzingImages}
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
          inferenceEvidenceIndices={report.inferenceEvidenceIndices}
          inferenceMetadata={report.inferenceMetadata}
          onEvidenceSelect={onEvidenceSelect}
          useAllFrames={useAllFrames}
          onUseAllFramesChange={onUseAllFramesChange}
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

        <ReportDiffPanel
          patientId={report.patientId}
          currentReportId={report.id}
          currentFindings={findings}
          currentImpression={impression}
        />
      </div>
    </div>
  );
}
